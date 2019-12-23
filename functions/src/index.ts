import * as express from 'express';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as AppModule from './appModule';
import * as ServiceModule from './serviceModule';
import * as DepositsModule from './depositsModule';
import * as WithdrawalsModule from './withdrawalsModule';
import * as WalletManager from './walletManager';
import * as WebhooksModule from './webhookModule';
import * as UsersModule from './usersModule';
import { api } from './requestHandlers';
import { Deposit, Withdrawal } from '../../shared/types';


// =============================================================================
//                              Initialization
// =============================================================================


const cors = require('cors')({ origin: true });
admin.initializeApp();

// Create "main" function to host all other top-level functions
const expressApp = express();
expressApp.use('/api', api);


// =============================================================================
//                              Callable functions
// =============================================================================


export const createApp = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called while authenticated.');
  }

  const owner = context.auth.uid;
  const appName: string = data.appName;

  if (!owner || !appName) {
    throw new functions.https.HttpsError('invalid-argument', 'invalid parameters provided.');
  }

  const [app, appError] = await AppModule.createApp(owner, appName);
  const result: any = {};

  if (appError) {
    result.error = true;
    result.message = appError.message;
  } else if (app) {
    result.error = false;
    result.appId = app.appId;
  }

  return result;
});

export const setAppWebhook = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called while authenticated.');
  }

  const owner = context.auth.uid;
  const appId: string = data.appId;
  const webhook: string | undefined = data.webhook;

  if (!appId) {
    throw new functions.https.HttpsError('invalid-argument', 'invalid parameters provided.');
  }

  const [newWebhook, error] = await AppModule.setAppWebhook(owner, appId, webhook);
  const result: any = {};

  if (error) {
    result.error = true;
    result.message = error.message;
  } else if (newWebhook) {
    result.error = false;
    result.webhook = newWebhook;
  }

  return result;
});


// =============================================================================
//                              Auth Triggers
// =============================================================================


exports.onServiceUserCreated = functions.auth.user().onCreate(async (user) => {
  await UsersModule.createServiceUser(user);
});


// =============================================================================
//                              Firestore Triggers
// =============================================================================


exports.onDepositUpdated = functions.firestore.document(`/apps/{appId}/deposits/{depositId}`)
.onUpdate(async (change, context) => {
  const oldState  = change.before.data() as Deposit;
  const newState  = change.after.data() as Deposit;

  await DepositsModule.processUserDepositUpdate(oldState, newState);
  return null;
});

exports.onWithdrawalUpdated = functions.firestore.document(`/apps/{appId}/withdrawals/{withdrawalId}`)
.onUpdate(async (change, context) => {
  const oldState  = change.before.data() as Withdrawal;
  const newState  = change.after.data() as Withdrawal;

  await WithdrawalsModule.processUserWithdrawalUpdate(oldState, newState);
  return null;
});

// exports.onUserUpdated = functions.firestore.document(`/apps/{appId}/users/{userId}`)
// .onUpdate(async (change, context) => {
//   const oldState = change.before.data() as AppUser;
//   const newState = change.after.data() as AppUser;

//   await UsersModule.processUserUpdated(oldState, newState);
// });


// =============================================================================
//                              HTTP Triggers
// =============================================================================


export const endpoints = functions.https.onRequest(expressApp);

export const bootstrap = functions.https.onRequest(async (request, response) => {
  cors(request, response, () => {
    const reqMasterPassword     = request.query.masterpass;
    const configMasterPassword  = functions.config().serviceadmin.password;

    if (reqMasterPassword !== configMasterPassword) {
      response.status(401).send('invalid master password!');
      return;
    }

    return ServiceModule.boostrapService().then(mnemonicSeed => {
      if (mnemonicSeed) {
        response.status(200).send({
          error: false,
          mnemonicSeed: mnemonicSeed
        });
      } else {
        response.status(405).send('error bootstrapping service');
      }
    }).catch(error => {
      response.status(405).send(error);
    });
  });
});

// // ******   FOR TESTING WEBHOOK   *****
// // can be commented out in production
// export const webhookTest = functions.https.onRequest((request, response) => {
//     console.log(JSON.stringify(request.body));
//     response.status(200).send('OK');
// });


// =============================================================================
//                              Scheduled functions
// =============================================================================


exports.updateMasterWallet = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
  await ServiceModule.updateMasterWallet();
});

exports.backupMasterWallet = functions.pubsub.schedule('every 6 hours').onRun(async (context) => {
  await WalletManager.backupMasterWallet();
});

exports.heartbeat = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
  await ServiceModule.updateDaemonInfo();

  const updateDeposits    = DepositsModule.updateDeposits();
  const updateWithdrawals = WithdrawalsModule.updateWithdrawals();
  const retryCallbacks    = WebhooksModule.retryCallbacks();

  return Promise.all([updateDeposits, updateWithdrawals, retryCallbacks]).catch(error => {
    console.error(error);
  });
});