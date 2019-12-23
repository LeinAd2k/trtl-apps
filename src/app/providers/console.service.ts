import { Injectable } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/functions';
import { TurtleApp, AppUser, UserTransfer, Recipient, Deposit, Withdrawal } from 'shared/types';
import { AngularFirestore } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { HttpHeaders } from '@angular/common/http';
import { TrtlApp as TA, ServiceError } from 'trtl-apps';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ConsoleService {

  constructor(
    private authService: AuthService,
    private afFunctions: AngularFireFunctions,
    private firestore: AngularFirestore) { }

  async createApp(appName: string): Promise<any> {
    return this.afFunctions.httpsCallable('createApp')({
      appName
    }).toPromise();
  }

  async setAppWebhook(appId: string, webhook: string | undefined) {
    return this.afFunctions.httpsCallable('setAppWebhook')({
      appId,
      webhook
    }).toPromise();
  }

  getUserApps(): Observable<TurtleApp[]> {
    const uid = this.authService.getUid();

    return this.firestore
    .collection<TurtleApp>(
      'apps',
      ref => ref.where('owner', '==', uid).orderBy('createdAt', 'desc'))
      .valueChanges();
  }

  getAppDeposits$(appId: string, limit: number, depositId?: string): Observable<Deposit[]> {
    if (depositId && depositId !== '') {
      return this.firestore
      .collection<Deposit>(`apps/${appId}/deposits`, ref => ref
        .where('id', '==', depositId).limit(limit)
        .orderBy('createdDate', 'desc'))
      .valueChanges();
    } else {
      return this.firestore
      .collection<Deposit>(`apps/${appId}/deposits`, ref => ref
        .limit(limit)
        .orderBy('createdDate', 'desc'))
      .valueChanges();
    }
  }

  getAppDeposit$(appId: string, depositId: string): Observable<Deposit | undefined> {
    return this.firestore.doc<Deposit>(`apps/${appId}/deposits/${depositId}`).valueChanges();
  }

  getAppWithdrawals$(appId: string, limit: number, withdrawalId?: string): Observable<Withdrawal[]> {
    if (withdrawalId && withdrawalId !== '') {
      return this.firestore
      .collection<Withdrawal>(`apps/${appId}/withdrawals`, ref => ref
        .where('id', '==', withdrawalId).limit(limit)
        .orderBy('timestamp', 'desc'))
      .valueChanges();
    } else {
      return this.firestore
      .collection<Withdrawal>(`apps/${appId}/withdrawals`, ref => ref
        .limit(limit)
        .orderBy('timestamp', 'desc'))
      .valueChanges();
    }
  }

  getAppWithdrawal$(appId: string, withdrawalId: string): Observable<Withdrawal | undefined> {
    return this.firestore.doc<Withdrawal>(`apps/${appId}/withdrawals/${withdrawalId}`).valueChanges();
  }

  getAppTransfers$(appId: string, limit: number, transferId?: string): Observable<UserTransfer[]> {
    if (transferId && transferId !== '') {
      return this.firestore
      .collection<UserTransfer>(`apps/${appId}/transfers`, ref => ref
        .where('id', '==', transferId).limit(limit)
        .orderBy('timestamp', 'desc'))
      .valueChanges();
    } else {
      return this.firestore
      .collection<UserTransfer>(`apps/${appId}/transfers`, ref => ref
        .limit(limit)
        .orderBy('timestamp', 'desc'))
      .valueChanges();
    }
  }

  getApp(appId: string): Observable<TurtleApp | undefined> {
    return this.firestore.doc<TurtleApp>(`apps/${appId}`).valueChanges();
  }

  getAppUsers$(appId: string, limit: number, userId?: string): Observable<AppUser[]> {
    if (userId && userId !== '') {
      return this.firestore
      .collection<AppUser>(`apps/${appId}/users`, ref => ref
        .where('userId', '==', userId).limit(limit)
        .orderBy('createdAt', 'desc'))
      .valueChanges();
    } else {
      return this.firestore
      .collection<AppUser>(`apps/${appId}/users`, ref => ref
        .limit(limit)
        .orderBy('createdAt', 'desc'))
      .valueChanges();
    }
  }

  getAppUser$(appId: string, userId: string): Observable<AppUser | undefined> {
    return this.firestore.doc<AppUser>(`apps/${appId}/users/${userId}`).valueChanges();
  }

  getTransfer$(appId: string, transferId: string): Observable<UserTransfer | undefined> {
    return this.firestore.doc<UserTransfer>(`apps/${appId}/transfers/${transferId}`).valueChanges();
  }

  async createAppUser(appId: string, appSecret: string): Promise<[AppUser | undefined, undefined | ServiceError]> {
    TA.initialize(appId, appSecret, { apiBase: environment.apiBase });
    return await TA.createUser();
  }

  async getAppUser(
    appId: string,
    appSecret: string,
    userId: string): Promise<[AppUser | undefined, undefined | ServiceError]> {

    TA.initialize(appId, appSecret, { apiBase: environment.apiBase });
    return await TA.getUser(userId);
  }

  async setWithdrawAddress(
    appId: string,
    appSecret: string,
    userId: string,
    address: string): Promise<[string | undefined, undefined | ServiceError]> {

    TA.initialize(appId, appSecret, { apiBase: environment.apiBase });
    return await TA.setWithdrawAddress(userId, address);
  }

  async userTransfer(
    appId: string,
    appSecret: string,
    senderId: string,
    receiverId: string,
    amount: number): Promise<[UserTransfer | undefined, undefined | ServiceError]> {

    TA.initialize(appId, appSecret, { apiBase: environment.apiBase });
    return await TA.transfer(senderId, receiverId, amount);
  }

  async userTransferMany(
    appId: string,
    appSecret: string,
    senderId: string,
    recipients: Recipient[]): Promise<[UserTransfer | undefined, undefined | ServiceError]> {

    TA.initialize(appId, appSecret, { apiBase: environment.apiBase });
    return await TA.transferMany(senderId, recipients);
  }

  async getFee(appId: string, appSecret: string): Promise<[number | undefined, undefined | ServiceError]> {
    TA.initialize(appId, appSecret, { apiBase: environment.apiBase });
    return await TA.getFee();
  }

  async withdraw(
    appId: string,
    appSecret: string,
    userId: string,
    amount: number,
    sendAddress?: string): Promise<[Withdrawal | undefined, undefined | ServiceError]> {

    TA.initialize(appId, appSecret, { apiBase: environment.apiBase });
    return await TA.withdraw(userId, amount, sendAddress);
  }

  setAppUserData(appId: string, appSecret: string, userId: string, data: any): Promise<boolean> {
    return Promise.resolve(false);
  }

  buildRequestHeaders(appSecret: string) {
    return {
      headers: new HttpHeaders({
        Authorization: `Bearer ${appSecret}`
      })
    };
  }
}