import * as admin from 'firebase-admin';
import * as WalletManager from './walletManager';
import * as AppModule from './appModule';
import * as ServiceModule from './serviceModule';
import { serviceChargesAccountId } from './constants';
import { ServiceError } from './serviceError';
import { createCallback, CallbackCode } from './webhookModule';
import { Account, AccountUpdate, TurtleApp, Withdrawal, WithdrawalUpdate,
  ServiceCharge, ServiceChargeUpdate, PreparedWithdrawal,
  WithdrawStatus ,PreparedWithdrawalUpdate } from '../../shared/types';
import { generateRandomSignatureSegement } from './utils';
import { ServiceConfig, ServiceWallet } from './types';
import { Transaction, PreparedTransaction } from 'turtlecoin-wallet-backend/dist/lib/Types';
// import { WalletError } from 'turtlecoin-wallet-backend';

export async function createPreparedWithdrawal(
  app: TurtleApp,
  account: Account,
  amount: number,
  address: string
): Promise<[PreparedWithdrawal | undefined, undefined | ServiceError]> {
  const [serviceConfig, configError] = await ServiceModule.getServiceConfig();

  if (!serviceConfig) {
    console.error(`failed to get service config: ${(configError as ServiceError)}`);
    return [undefined, new ServiceError('service/unknown-error')];
  }

  const serviceCharge = serviceConfig.serviceCharge;

  if (account.balanceUnlocked < (amount + serviceCharge)) {
    return [undefined, new ServiceError('transfer/insufficient-funds')];
  }

  const [serviceWallet, walletError] = await WalletManager.getServiceWallet();

  if (!serviceWallet) {
    console.error(`failed to get service wallet: ${(walletError as ServiceError)}`);
    return [undefined, new ServiceError('service/unknown-error')];
  }

  const paymentId = account.spendSignaturePrefix.concat(generateRandomSignatureSegement());

  const destinations: [string, number][] = [
    [address, amount]
  ];

  const [balanceLocked, balanceUnlocked] = serviceWallet.wallet.getBalance([app.subWallet]);

  console.log(`app balances => unlocked: ${balanceUnlocked}, locked: ${balanceLocked}`);

  const sendResult = await serviceWallet.wallet.sendTransactionAdvanced(
                      destinations,
                      undefined,
                      undefined,
                      paymentId,
                      [app.subWallet],
                      app.subWallet,
                      false);

  console.log(`send error: [${sendResult.error.errorCode}] ${sendResult.error.toString()}`);
  console.log(`send hash: ${sendResult.transactionHash}`);
  console.log(`send fee: ${sendResult.fee}`);

  if (sendResult.success && sendResult.preparedTransaction && sendResult.fee !== undefined) {
    const txFee     = sendResult.fee;
    const timestamp = Date.now();

    const preparedDocRef = admin.firestore().collection(`apps/${app.appId}/preparedWithdrawals`).doc();
    const preparedTxJson = JSON.stringify(sendResult.preparedTransaction);

    const preparedWithdrawal: PreparedWithdrawal = {
      id: preparedDocRef.id,
      appId: app.appId,
      accountId: account.id,
      preparedTxJson: preparedTxJson,
      timestamp: timestamp,
      lastUpdate: timestamp,
      status: 'ready',
      address: address,
      amount: amount,
      fee: txFee,
      serviceCharge: serviceCharge,
      paymentId: paymentId
    }

    try {
      await preparedDocRef.create(preparedWithdrawal);
    } catch (error) {
      console.log(error);
      return [undefined, new ServiceError('service/unknown-error')];
    }

    return [preparedWithdrawal, undefined];
  } else {
    const sendErrorMessage = sendResult.error.toString();
    console.log(`send error: [${sendResult.error.errorCode}] ${sendErrorMessage}`);
    return [undefined, new ServiceError('service/unknown-error', sendErrorMessage)];
  }
}

export async function executePreparedWithdrawal(
  appId: string,
  preparedWithdrawalId: string): Promise<[Withdrawal | undefined, undefined | ServiceError]> {

  const [serviceConfig, configError] = await ServiceModule.getServiceConfig();

  if (!serviceConfig) {
    console.log((configError as ServiceError).message);
    return [undefined, configError];
  }

  const preparedDocRef  = admin.firestore().doc(`apps/${appId}/preparedWithdrawals/${preparedWithdrawalId}`);
  const preparedDoc     = await preparedDocRef.get();

  if (!preparedDoc.exists) {
    return [undefined, new ServiceError('app/prepared-withdrawal-not-found')];
  }

  const preparedWithdrawal = preparedDoc.data() as PreparedWithdrawal;

  if (preparedWithdrawal.status !== 'ready') {
    return [undefined, new ServiceError('app/invalid-prepared-withdrawal', `invalid status: ${preparedWithdrawal.status}`)];
  }

  const preparedTransaction = JSON.parse(preparedWithdrawal.preparedTxJson) as PreparedTransaction;

  if (!preparedTransaction) {
    return [undefined, new ServiceError('app/invalid-prepared-withdrawal')];
  }

  const withdrawalAccountDoc = await admin.firestore().doc(`apps/${appId}/accounts/${preparedWithdrawal.accountId}`).get();

  if (!withdrawalAccountDoc.exists) {
    return [undefined, new ServiceError('app/account-not-found')];
  }

  const withdrawalAccount   = withdrawalAccountDoc.data() as Account;
  const serviceChargeAmount = serviceConfig.serviceCharge;
  const totalAmount         = preparedWithdrawal.amount + preparedWithdrawal.fee + serviceChargeAmount;

  if (withdrawalAccount.balanceUnlocked < totalAmount) {
    return [undefined, new ServiceError('transfer/insufficient-funds')];
  }

  const withdrawDoc = admin.firestore().collection(`apps/${appId}/withdrawals`).doc();
  const timestamp   = Date.now();

  const withdrawal: Withdrawal = {
    id:                   withdrawDoc.id,
    paymentId:            preparedWithdrawal.paymentId,
    status:               'pending',
    blockHeight:          0,
    appId:                preparedWithdrawal.appId,
    accountId:            preparedWithdrawal.accountId,
    amount:               preparedWithdrawal.amount,
    fee:                  preparedWithdrawal.fee,
    serviceChargeAmount:  preparedWithdrawal.serviceCharge,
    address:              preparedWithdrawal.address,
    preparedWithdrawalId: preparedWithdrawalId,
    requestedAtBlock:     0,
    timestamp:            timestamp,
    lastUpdate:           timestamp,
    failed:               false,
    userDebited:          true
  };

  try {
    await admin.firestore().runTransaction(async (txn): Promise<any> => {
      const accountDocRef = admin.firestore().doc(`apps/${appId}/accounts/${withdrawal.accountId}`);
      const accountDoc    = await txn.get(accountDocRef);
      const account       = accountDoc.data() as Account;

      if (account.balanceUnlocked >= totalAmount) {
        if (withdrawal.serviceChargeAmount > 0) {
          const serviceChargeDocRef = admin.firestore().collection(`apps/${appId}/serviceCharges`).doc();

          const serviceCharge: ServiceCharge = {
            id:                 serviceChargeDocRef.id,
            appId:              withdrawal.appId,
            type:               'withdrawal',
            withdrawalId:       withdrawal.id,
            timestamp:          timestamp,
            amount:             serviceConfig.serviceCharge,
            chargedAccountId:   withdrawal.accountId,
            lastUpdate:         timestamp,
            cancelled:          false,
            status:             'confirming'
          }

          const chargeAccountDocRef = admin.firestore().doc(`apps/${withdrawal.appId}/serviceAccounts/${serviceChargesAccountId}`);
          const chargeAccountDoc    = await txn.get(chargeAccountDocRef);

          if (!chargeAccountDoc.exists) {
            return Promise.reject('service charge account not found.');
          }

          const chargeAccount = chargeAccountDoc.data() as Account;

          const chargeAccountUpdate: AccountUpdate = {
            balanceLocked: chargeAccount.balanceLocked + withdrawal.serviceChargeAmount
          }

          txn.update(chargeAccountDocRef, chargeAccountUpdate);
          txn.create(serviceChargeDocRef, serviceCharge);

          withdrawal.serviceChargeId = serviceCharge.id;
        }

        const accountUpdate: AccountUpdate = {
          balanceUnlocked: account.balanceUnlocked - totalAmount
        }

        const preparedWithdrawalUpdate: PreparedWithdrawalUpdate = {
          lastUpdate: timestamp,
          status: 'sent'
        }

        txn.create(withdrawDoc, withdrawal);
        txn.update(accountDocRef, accountUpdate);
        txn.update(preparedDocRef, preparedWithdrawalUpdate);
      } else {
        return Promise.reject('insufficient unlocked funds.');
      }
    });
  } catch (error) {
    console.error(error);
    return [undefined, new ServiceError('service/unknown-error', error)];
  }

  return [withdrawal, undefined];
}

export async function processPendingWithdrawal(withdrawal: Withdrawal): Promise<void> {
  const withdrawalDocRef = admin.firestore().doc(`apps/${withdrawal.appId}/withdrawals/${withdrawal.id}`);

  if (withdrawal.status !== 'pending') {
    console.error(`new withdrawal request ${withdrawal.id} not in pending state, skipping further processing.`);
    return;
  }

  if (!withdrawal.preparedWithdrawalId) {
    console.error(`pending withdrawal [${withdrawal.id}] missing pendingWithdrawal id!`);
    return;
  }

  const preparedWithdrawalDoc = await admin.firestore()
                                .doc(`apps/${withdrawal.appId}/preparedWithdrawals/${withdrawal.preparedWithdrawalId}`)
                                .get();

  if (!preparedWithdrawalDoc.exists) {
    console.error(`unabled to find prepared withdrawal with id: ${withdrawal.preparedWithdrawalId}`);
    return;
  }

  const preparedWithdrawal = preparedWithdrawalDoc.data() as PreparedWithdrawal;
  const preparedTransaction = JSON.parse(preparedWithdrawal.preparedTxJson) as PreparedTransaction;

  if (!preparedTransaction) {
    console.error(`unabled to deserialize prepared transaction JSON with id: ${withdrawal.preparedWithdrawalId}`);
    return;
  }

  const [app, appError] = await AppModule.getApp(withdrawal.appId);

  if (!app) {
    console.log((appError as ServiceError).message);
    return;
  }

  const [serviceWallet, error] = await WalletManager.getServiceWallet();

  if (!serviceWallet) {
    console.error(`failed to get service wallet: ${(error as ServiceError)}`);
    return;
  }

  const [walletBlockCount, ,] = serviceWallet.wallet.getSyncStatus();


  const confirmingUpdate: WithdrawalUpdate = {
    lastUpdate: Date.now(),
    status: 'confirming',
    requestedAtBlock: walletBlockCount
  }

  try {
    await withdrawalDocRef.update(confirmingUpdate);
  } catch (error) {
    console.log(error);
    return;
  }

  const sendResult = await serviceWallet.wallet.sendRawPreparedTransaction(preparedTransaction);

  const txSentUpdate: WithdrawalUpdate = {
    lastUpdate: Date.now()
  }

  if (sendResult.success) {
    txSentUpdate.txHash = sendResult.transactionHash
  } else {
    console.log(sendResult.error);

    txSentUpdate.status = 'faulty';
    txSentUpdate.nodeErrorCode = sendResult.error.errorCode;
  }

  await withdrawalDocRef.update(txSentUpdate);
}

// if for any reason a withdrawal was sent without creating a corresponding Withdrawal
// object in firestore, it will get picked up and added here.
export async function addUnprocessedWithdrawalByHash(
  serviceWallet: ServiceWallet,
  appId: string,
  txHash: string): Promise<boolean> {

  const transaction = serviceWallet.wallet.getTransaction(txHash);

  if (!transaction) {
    console.log(`unable to find tx with hash ${txHash} in wallet`);
    return false;
  }

  const [app, appError] = await AppModule.getApp(appId);

  if (!app) {
    console.log((appError as ServiceError).message);
    return false;
  }

  const appAccounts = await AppModule.getAppAccounts(appId);

  // get the account of this tx hash by scanning spend prefix
  const account = appAccounts.find(acc => transaction.paymentID.startsWith(acc.spendSignaturePrefix));

  if (!account) {
    console.error(`unable to find account that spent tx hash: ${txHash} in app ${appId}`);
    return false;
  }

  const preparedWithdrawalDocs = await admin.firestore()
                                  .collection(`apps/${appId}/preparedWithdrawals`)
                                  .where('paymentId', '==', transaction.paymentID)
                                  .get();

  if (preparedWithdrawalDocs.size !== 1) {
    // TODO: if we cant find the prepared withdrawal, a serious error orccured since
    // only prepared withdrawals should be able to execute wallet transactions.
    // consider disabling this app and investigate the issue.

    console.error(`unable to find prepared withdrawal that spent tx hash: ${txHash} in app ${appId}`);
    return false;
  }

  const preparedWithdrawal  = preparedWithdrawalDocs.docs[0].data() as PreparedWithdrawal;
  const address             = preparedWithdrawal.address;
  const serviceChargeAmount = preparedWithdrawal.serviceCharge;

  const [walletHeight, ,] = serviceWallet.wallet.getSyncStatus();
  const completed = transaction.blockHeight + serviceWallet.serviceConfig.txConfirmations > walletHeight;
  const status: WithdrawStatus = completed ? 'completed' : 'confirming';

  const timestamp       = Date.now();
  const txFee           = transaction.fee;
  let withdrawalAmount  = -txFee;

  transaction.transfers.forEach((amount, publicKey) => {
    if (publicKey === app.publicKey && amount < 0) {
      withdrawalAmount -= amount; // we decrement to get a positive count
    }
  });

  if (withdrawalAmount !== preparedWithdrawal.amount) {
    // TODO: if the amounts dont match, a serious error orccured
    // consider disabling this app and investigate the issue.

    console.error(`amount in prepared withdrawal that spent tx hash: ${txHash} in app ${appId} does not match wallet tx`);
    return false;
  }

  const withdrawalDocRef = admin.firestore().collection(`apps/${appId}/withdrawals`).doc();

  const withdrawal: Withdrawal = {
    id:                   withdrawalDocRef.id,
    paymentId:            transaction.paymentID,
    appId:                appId,
    accountId:            account.id,
    amount:               preparedWithdrawal.amount,
    fee:                  txFee,
    serviceChargeAmount:  serviceChargeAmount,
    userDebited:          true,
    address:              address,
    timestamp:            timestamp,
    lastUpdate:           timestamp,
    status:               status,
    requestedAtBlock:     walletHeight,
    blockHeight:          transaction.blockHeight,
    failed:               false,
    txHash:               txHash
  }

  await withdrawalDocRef.set(withdrawal);

  console.log(`added unprocessed withdrawal with hash ${txHash}, withdrawal id: ${withdrawal.id}`);
  return true;
}

export async function getWithdrawal(
  appId: string,
  withdrawalId: string): Promise<[Withdrawal | undefined, undefined | ServiceError]> {

  const withdrawalDoc = await admin.firestore().doc(`apps/${appId}/withdrawals/${withdrawalId}`).get();

  if (withdrawalDoc.exists) {
    const depositRequest = withdrawalDoc.data() as Withdrawal;
    return [depositRequest, undefined];
  } else {
    return [undefined, new ServiceError('app/withdrawal-not-found')];
  }
}

export async function updateWithdrawals(serviceWallet: ServiceWallet): Promise<void> {
  const [walletHeight,,]  = serviceWallet.wallet.getSyncStatus();
  const scanHeight        = Math.max(0, serviceWallet.serviceConfig.txScanDepth);

  const transactions = serviceWallet.wallet
                        .getTransactions(undefined, undefined, false)
                        .filter(tx => {
                          const transfers = Array.from(tx.transfers.values());

                          // tx must be above scan height and contain at least one negative amount transfer
                          return tx.blockHeight >= scanHeight && transfers.find(t => t < 0)
                        });

  // Retry 'pending' withdrawals that have not been updated in at least 5 mins.
  const pendingCutoff = Date.now() - (5 * 60 * 1000);

  const pendingDocs = await admin.firestore()
                      .collectionGroup('withdrawals')
                      .where('status', '==', 'pending')
                      .where('lastUpdate', '<', pendingCutoff)
                      .get();

  if (pendingDocs.size > 0) {
    const pendingWithdrawals      = pendingDocs.docs.map(d => d.data() as Withdrawal);
    const processPendingPromises  = pendingWithdrawals.map(withdrawal => processPendingWithdrawal(withdrawal));

    await Promise.all(processPendingPromises);
  }

  // Process faulty withdrawals
  const faultyDocs = await admin.firestore()
                      .collectionGroup('withdrawals')
                      .where('status', '==', 'faulty')
                      .get();

  if (faultyDocs.size > 0) {
    const faultyWithdrawals = faultyDocs.docs.map(d => d.data() as Withdrawal);

    const processFaultyPromises = faultyWithdrawals.map(withdrawal =>
                                    processFaultyWithdrawal(
                                      withdrawal,
                                      serviceWallet.serviceConfig,
                                      transactions,
                                      walletHeight));

    await Promise.all(processFaultyPromises);
  }

  // Process confirming withdrawals
  const confirmingDocs = await admin.firestore()
                          .collectionGroup('withdrawals')
                          .where('status', '==', 'confirming')
                          .get();

  if (confirmingDocs.size > 0) {
    const confirmingWithdrawals = confirmingDocs.docs.map(d => d.data() as Withdrawal);

    const processConfirmingPromises = confirmingWithdrawals.map(withdrawal =>
                                        processConfirmingWithdrawal(
                                          withdrawal,
                                          serviceWallet.serviceConfig,
                                          transactions,
                                          walletHeight));

    await Promise.all(processConfirmingPromises);
  }
}

export async function processLostWithdrawals(serviceWallet: ServiceWallet): Promise<void> {
  const withdrawalDocs = await admin.firestore()
                          .collectionGroup('withdrawals')
                          .where('status', '==', 'lost')
                          .get();

  if (withdrawalDocs.size === 0) {
    return;
  }

  const lostWithdrawals = withdrawalDocs.docs.map(d => d.data() as Withdrawal);

  const promises = lostWithdrawals.map(withdrawal =>
                    processLostWithdrawal(withdrawal, serviceWallet));

  await Promise.all(promises);
}

async function processLostWithdrawal(withdrawal: Withdrawal, serviceWallet: ServiceWallet): Promise<any> {
  const [walletHeight, ,] = serviceWallet.wallet.getSyncStatus();

  // a lost withdrawal can be safely cancelled based on some node error codes.
  if (hasConfirmedFailureErrorCode(withdrawal, walletHeight, serviceWallet.serviceConfig)) {
    return cancelFailedWithdrawal(withdrawal.appId, withdrawal.id);
  }

  const transactions = serviceWallet.wallet
                        .getTransactions(undefined, undefined, false)
                        .filter(tx => {
                          const transfers = Array.from(tx.transfers.values());

                          // transfers must contain at least one negative amount transfer
                          return transfers.find(t => t < 0)
                        });

  // it can be completed if we find it's payment ID in the wallet and it has needed confirmations
  const transaction = transactions.find(tx => tx.paymentID === withdrawal.paymentId);

  if (transaction) {
    const blockHeight = transaction.blockHeight;

    if (blockHeight !== 0) {
      const confirmationsNeeded = serviceWallet.serviceConfig.txConfirmations;
      const completionHeight    = blockHeight + confirmationsNeeded;

      if (walletHeight >= completionHeight) {
        return processSuccessfulWithdrawal(withdrawal, transaction);
      }
    }
  }
}

export async function processWithdrawalUpdate(
  oldState: Withdrawal,
  newState: Withdrawal): Promise<void> {

  if (oldState.status === 'confirming' && newState.status === 'completed') {
    const [app, error] = await AppModule.getApp(oldState.appId);

    if (!app) {
      console.error((error as ServiceError).message);
      return;
    }

    const callbackCode: CallbackCode = newState.failed ? 'withdrawal/failed' : 'withdrawal/succeeded';

    await createCallback(app, callbackCode, newState);
  }
}

async function processFaultyWithdrawal(
  withdrawal: Withdrawal,
  serviceConfig: ServiceConfig,
  transactions: Transaction[],
  walletHeight: number): Promise<any> {

  // a Faulty withdrawal can recover to 'confirming' if we can find it's payment ID in the wallet txs.
  const tx = transactions.find(t => t.paymentID === withdrawal.paymentId);

  if (tx) {
    const updateObject: WithdrawalUpdate = {
      lastUpdate: Date.now(),
      status: 'confirming',
      txHash: tx.hash
    }

    return await admin.firestore().doc(`apps/${withdrawal.appId}/withdrawals/${withdrawal.id}`).update(updateObject);
  }

  if (hasConfirmedFailureErrorCode(withdrawal, walletHeight, serviceConfig)) {
    await cancelFailedWithdrawal(withdrawal.appId, withdrawal.id);
    return;
  }

  // The withdrawal will be marked as lost after the wallet height exceeds withdrawTimoutBlocks
  if (walletHeight > (withdrawal.requestedAtBlock + serviceConfig.withdrawTimoutBlocks)) {
    await markLostWithdrawal(withdrawal.appId, withdrawal.id);
  }
}

function hasConfirmedFailureErrorCode(
  withdrawal: Withdrawal,
  walletHeight: number,
  serviceConfig: ServiceConfig): boolean {

  if (!withdrawal.nodeErrorCode) {
    return false;
  }

  // give a little time to pick up the transaction in case of false-positive error code
  if (walletHeight < (withdrawal.requestedAtBlock + serviceConfig.txConfirmations)) {
    return false;
  }

  switch (withdrawal.nodeErrorCode) {
    case 11:
      /* Amount + fee is greater than the total balance available in the
          subwallets specified (or all wallets, if not specified) */
      return true;
    default:
      return false;
  }
}

async function processConfirmingWithdrawal(
  withdrawal: Withdrawal,
  serviceConfig: ServiceConfig,
  transactions: Transaction[],
  walletHeight: number): Promise<any> {

  const withdrawalPath  = `apps/${withdrawal.appId}/withdrawals/${withdrawal.id}`;
  const transaction     = transactions.find(tx => tx.paymentID === withdrawal.paymentId);

  if (transaction) {
    const blockHeight = transaction.blockHeight;

    if (blockHeight !== 0) {
      const completionHeight = blockHeight + serviceConfig.txConfirmations;

      if (walletHeight >= completionHeight) {
        return processSuccessfulWithdrawal(withdrawal, transaction);
      } else {
        // transaction is included in a block, waiting for confirmations.
        if (withdrawal.txHash !== transaction.hash || withdrawal.blockHeight !== blockHeight) {
          const withdrawalUpdate: WithdrawalUpdate = {
            lastUpdate: Date.now(),
            txHash: transaction.hash,
            blockHeight: blockHeight
          };

          await admin.firestore().doc(withdrawalPath).update(withdrawalUpdate);
        }
      }
    } else {
      // transaction not yet included in a block.
    }
  } else {
    // check if the withdrawal request failed
    const failureHeight = withdrawal.requestedAtBlock + serviceConfig.withdrawTimoutBlocks;

    if (walletHeight >= failureHeight) {
      return cancelFailedWithdrawal(withdrawal.appId, withdrawal.id);
    }
  }
}

async function processSuccessfulWithdrawal(withdrawal: Withdrawal, transaction: Transaction): Promise<void> {
  const [app, appError] = await AppModule.getApp(withdrawal.appId);

  if (!app) {
    console.error(`failed to find app for completed witdhrawal: ${(appError as ServiceError).message}`);
    return;
  }

  // check amount
  let txAmount = 0;

  transaction.transfers.forEach((amount, publicKey) => {
    if (publicKey === app.publicKey && amount < 0) {
      txAmount += amount;
    }
  });

  if (Math.abs(txAmount) !== withdrawal.amount + withdrawal.fee) {
    console.error(`incorrect withdrawal amount! found amount [${Math.abs(txAmount)}], expected: [${withdrawal.amount}]`);
    return
  }

  const withdrawalPath = `apps/${withdrawal.appId}/withdrawals/${withdrawal.id}`;

  const withdrawalUpdate: WithdrawalUpdate = {
    lastUpdate:   Date.now(),
    status:       'completed',
    txHash:       transaction.hash,
    blockHeight:  transaction.blockHeight
  };

  await admin.firestore().doc(withdrawalPath).update(withdrawalUpdate);

  if (withdrawal.serviceChargeId) {
    try {
      const chargeUpdate: ServiceChargeUpdate = {
        lastUpdate: Date.now(),
        status: 'processing'
      }

      await admin.firestore()
                  .doc(`apps/${withdrawal.appId}/serviceCharges/${withdrawal.serviceChargeId}`)
                  .update(chargeUpdate);
    } catch (error) {
      console.error(`error updating withdrawal [${withdrawal.id}] service charge doc with id [${withdrawal.serviceChargeId}]!`);
    }
  }
}

async function markLostWithdrawal(appId: string, withdrawalId: string): Promise<void> {
  try {
    await admin.firestore().runTransaction(async (txn): Promise<any> => {
      const withdrawalDocRef  = admin.firestore().doc(`apps/${appId}/withdrawals/${withdrawalId}`);
      const withdrawalDoc     = await txn.get(withdrawalDocRef);

      if (!withdrawalDoc.exists) {
        return Promise.reject('withdrawal doc does not exist.');
      }

      const withdrawalUpdate: WithdrawalUpdate = {
        status:       'lost',
        lastUpdate:   Date.now()
      }

      txn.update(withdrawalDocRef, withdrawalUpdate);
    });
  } catch (error) {
    console.error(error);
  }
}

async function cancelFailedWithdrawal(appId: string, withdrawalId: string): Promise<void> {
  try {
    await admin.firestore().runTransaction(async (txn): Promise<any> => {
      const withdrawalDocRef  = admin.firestore().doc(`apps/${appId}/withdrawals/${withdrawalId}`);
      const withdrawalDoc     = await txn.get(withdrawalDocRef);

      if (!withdrawalDoc.exists) {
        return Promise.reject('withdrawal doc does not exist.');
      }

      const withdrawal        = withdrawalDoc.data() as Withdrawal;
      const totalAmount       = withdrawal.amount + withdrawal.fee + withdrawal.serviceChargeAmount;
      const serviceChargeId   = withdrawal.serviceChargeId;
      const accountDocRef     = admin.firestore().doc(`apps/${appId}/accounts/${withdrawal.accountId}`);
      const accountDoc        = await txn.get(accountDocRef);

      if (!accountDoc.exists) {
        return Promise.reject('account doc does not exist.');
      }

      const account = accountDoc.data() as Account;
      let serviceCharge: ServiceCharge | undefined;

      if (serviceChargeId) {
        const chargeDocRef    = admin.firestore().doc(`apps/${appId}/serviceCharges/${serviceChargeId}`);
        const chargeDoc       = await txn.get(chargeDocRef);

        if (!chargeDoc.exists) {
          return Promise.reject('service charge doc does not exist.');
        }

        serviceCharge = chargeDoc.data() as ServiceCharge;

        if (serviceCharge.cancelled) {
          return Promise.reject('service charge already cancelled.');
        }

        const serviceChargeUpdate: ServiceChargeUpdate = {
          lastUpdate: Date.now(),
          cancelled: true,
          status: 'processing'
        }

        txn.update(chargeDocRef, serviceChargeUpdate);
      }

      const withdrawalUpdate: WithdrawalUpdate = {
        status:       'completed',
        failed:       true,
        userDebited:  false,
        lastUpdate:   Date.now()
      }

      const accountUpdate: AccountUpdate = {
        balanceUnlocked: account.balanceUnlocked + totalAmount
      }

      txn.update(withdrawalDocRef, withdrawalUpdate);
      txn.update(accountDocRef, accountUpdate);
    });
  } catch (error) {
    console.error(error);
  }
}
