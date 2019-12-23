import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-webhooks',
  templateUrl: './webhooks.component.html',
  styleUrls: ['./webhooks.component.scss']
})
export class WebhooksComponent implements OnInit {

  depositConfirming = {
    code: 'deposit/confirming',
    data: {
      id: 'eb5b3138ff0dbcb060eb111b7609d01d',
      appId: '84U0IRP0rdC57AHfwRQc',
      userId: 'pwBBKwhhVXJ16xtEcgKA',
      blockHeight: 2104164,
      paymentId: '6a8db2c83a34f29275d3cfad7100944168c46fd5d43e074aa038e18a0410c7dd',
      depositAddress: 'TRTLuxVTfpvXTXbsQxzqy5KHyHXTQZbtEHnAsorKPqkweHzDRcRyM28g6jJMQjBoocYqsjtR3G5n1ipuDpn6VbqZQWnQ198HZcD',
      amount: 25,
      integratedAddress: 'TRTLuxsFnkbHRdfoKCFc8KJ6Rzvp1TdqLHdJctadbENjAZx5mhgXqQXA6kNfcuNnap94kdBUwnfvPHvh82YufKFmHbXLoKCzfHLXTXbsQxzqy5KHyHXTQZbtEHnAsorKPqkweHzDRcRyM28g6jJMQjBoocYqsjtR3G5n1ipuDpn6VbqZQWnQ1D22qvB',
      txHash: 'e392965de03d3553df994baffba2bbb027ec83c947c4ddec9d6791cc86bca588',
      createdDate: 1576336806682,
      status: 'confirming',
      userCredited: false,
      lastUpdate: 1576336806682,
      cancelled: false
    }
  };

  depositSucceeded = {
    code: 'deposit/succeeded',
    data: {
      amount: 25,
      appId: '84U0IRP0rdC57AHfwRQc',
      blockHeight: 2104164,
      cancelled: false,
      createdDate: 1576336806682,
      depositAddress: 'TRTLuxVTfpvXTXbsQxzqy5KHyHXTQZbtEHnAsorKPqkweHzDRcRyM28g6jJMQjBoocYqsjtR3G5n1ipuDpn6VbqZQWnQ198HZcD',
      id: 'eb5b3138ff0dbcb060eb111b7609d01d',
      integratedAddress: 'TRTLuxsFnkbHRdfoKCFc8KJ6Rzvp1TdqLHdJctadbENjAZx5mhgXqQXA6kNfcuNnap94kdBUwnfvPHvh82YufKFmHbXLoKCzfHLXTXbsQxzqy5KHyHXTQZbtEHnAsorKPqkweHzDRcRyM28g6jJMQjBoocYqsjtR3G5n1ipuDpn6VbqZQWnQ1D22qvB',
      lastUpdate: 1576337042609,
      paymentId: '6a8db2c83a34f29275d3cfad7100944168c46fd5d43e074aa038e18a0410c7dd',
      status: 'completed',
      txHash: 'e392965de03d3553df994baffba2bbb027ec83c947c4ddec9d6791cc86bca588',
      userCredited: true,
      userId: 'pwBBKwhhVXJ16xtEcgKA'
    }
  };

  depositCancelled = {
    code: 'deposit/cancelled',
    data: {
      amount: 25,
      appId: '84U0IRP0rdC57AHfwRQc',
      blockHeight: 0,
      cancelled: true,
      createdDate: 1576336806682,
      depositAddress: 'TRTLuxVTfpvXTXbsQxzqy5KHyHXTQZbtEHnAsorKPqkweHzDRcRyM28g6jJMQjBoocYqsjtR3G5n1ipuDpn6VbqZQWnQ198HZcD',
      id: 'eb5b3138ff0dbcb060eb111b7609d01d',
      integratedAddress: 'TRTLuxsFnkbHRdfoKCFc8KJ6Rzvp1TdqLHdJctadbENjAZx5mhgXqQXA6kNfcuNnap94kdBUwnfvPHvh82YufKFmHbXLoKCzfHLXTXbsQxzqy5KHyHXTQZbtEHnAsorKPqkweHzDRcRyM28g6jJMQjBoocYqsjtR3G5n1ipuDpn6VbqZQWnQ1D22qvB',
      lastUpdate: 1576337042609,
      paymentId: '6a8db2c83a34f29275d3cfad7100944168c46fd5d43e074aa038e18a0410c7dd',
      status: 'completed',
      userCredited: false,
      userId: 'pwBBKwhhVXJ16xtEcgKA'
    }
  };

  withdrawalSucceeded = {
    code: 'withdrawal/succeeded',
    data: {
      address: 'TRTLv32bGBP2cfM3SdijU4TTYnCPoR33g5eTas6n9HamBvu8ozc9BZHWza5j7cmBFSgh4dmmGRongfoEEzcvuAEF8dLxixsS7he',
      amount: 5,
      appId: '84U0IRP0rdC57AHfwRQc',
      blockHeight: 2104302,
      failed: false,
      fee: 10,
      id: 'mbEz7SwYhNxPRWnb8MYb',
      lastUpdate: 1576341061152,
      paymentId: 'dd1b2917f574f5ce2b0fbbfdb0c9d0be7482125fcd93436933c8fe75c38c8a4b',
      requestedAtBlock: 2104300,
      status: 'completed',
      timestamp: 1576340903981,
      txHash: '07e8f4ee5a0dcdf3ca3ce987069f107d045def181d438696114fb6990fb3c72c',
      userId: 'jaKrijd8WjHRWTu2y8pG'
    }
  };

  withdrawalFailed = {
    code: 'withdrawal/failed',
    data: {
      address: 'TRTLv32bGBP2cfM3SdijU4TTYnCPoR33g5eTas6n9HamBvu8ozc9BZHWza5j7cmBFSgh4dmmGRongfoEEzcvuAEF8dLxixsS7he',
      amount: 5,
      appId: '84U0IRP0rdC57AHfwRQc',
      blockHeight: 2104302,
      failed: true,
      fee: 10,
      id: 'mbEz7SwYhNxPRWnb8MYb',
      lastUpdate: 1576341061152,
      paymentId: 'dd1b2917f574f5ce2b0fbbfdb0c9d0be7482125fcd93436933c8fe75c38c8a4b',
      requestedAtBlock: 2104300,
      status: 'completed',
      timestamp: 1576340903981,
      userId: 'jaKrijd8WjHRWTu2y8pG'
    }
  };

  userUpdated = {
    code: 'user/updated',
    data: {
      appId: '84U0IRP0rdC57AHfwRQc',
      balanceLocked: 0,
      balanceUnlocked: 5,
      createdAt: 1576008872016,
      deleted: false,
      depositAddress: 'TRTLuxsFnkbHRdfoKCFc8KJ6Rzvp1TdqLHdJctadbENjAZx5mhgXqQXA6kNfcuNnap94kdBUwnfvPHvh82YufKFmHbXLoKCzfHLXTXbsQxzqy5KHyHXTQZbtEHnAsorKPqkweHzDRcRyM28g6jJMQjBoocYqsjtR3G5n1ipuDpn6VbqZQWnQ1D22qvB',
      depositQrCode: 'https://chart.googleapis.com/chart?cht=qr&chs=256x256&chl=turtlecoin://TRTLuxsFnkbHRdfoKCFc8KJ6Rzvp1TdqLHdJctadbENjAZx5mhgXqQXA6kNfcuNnap94kdBUwnfvPHvh82YufKFmHbXLoKCzfHLXTXbsQxzqy5KHyHXTQZbtEHnAsorKPqkweHzDRcRyM28g6jJMQjBoocYqsjtR3G5n1ipuDpn6VbqZQWnQ1D22qvB',
      paymentId: '6a8db2c83a34f29275d3cfad7100944168c46fd5d43e074aa038e18a0410c7dd',
      userId: 'pwBBKwhhVXJ16xtEcgKA',
      withdrawAddress: 'TRTLv32bGBP2cfM3SdijU4TTYnCPoR33g5eTas6n9HamBvu8ozc9BZHWza5j7cmBFSgh4dmmGRongfoEEzcvuAEF8dLxixsS7he'
    }
  };

  constructor() { }

  ngOnInit() {
  }

}