import * as admin from "firebase-admin";
import * as functions from 'firebase-functions';
import * as requester from "request";
import { QuickBooks } from './libs/qbmain';
import { CompanySync } from "./models/Cloud/CompanySync";
import { OrderCreate } from './models/Cloud/OrderCreate';
import { EmptyQboConfig } from "./models/Cloud/QboEnvironment";
import { emptyDaudiCustomer } from './models/Daudi/customer/Customer';
import { Order } from "./models/Daudi/order/Order";
import { SMS } from './models/Daudi/sms/sms';
import { MyTimestamp } from './models/firestore/firestoreTypes';
import { QboOrder } from "./models/Qbo/QboOrder";
import { toObject } from "./models/utils/SnapshotUtils";
import { creteOrder, updateOrder } from './tasks/crud/daudi/Order';
import { ReadAndInstantiate, readQboConfig } from "./tasks/crud/daudi/QboConfig";
import { updateCustomer } from './tasks/crud/qbo/customer/update';
import { createQboOrder } from './tasks/crud/qbo/Order/create';
import { sendsms } from './tasks/sms/sms';
import { ordersms } from './tasks/sms/smscompose';
import { processSync } from './tasks/syncdb/processSync';
import { validorderupdate } from './validators/orderupdate';
import { createQbo } from "./tasks/sharedqb";
import { EquityBulk } from "./models/ipn/EquityBulk";
import { paymentFcm } from "./tasks/FCM/paymentFcm";
import { resolveIpn } from "./tasks/resolvepayment";

admin.initializeApp(functions.config().firebase);
admin.firestore().settings({ timestampsInSnapshots: true });


const alreadyRunEventIDs: Array<string> = [];

function isAlreadyRunning(eventID: string) {
  return alreadyRunEventIDs.indexOf(eventID) >= 0;
}

function markAsRunning(eventID: string) {
  alreadyRunEventIDs.push(eventID);
}
/**
 * create an estimate from the client directly
 */
exports.createEstimate = functions.https.onCall((data: OrderCreate, context) => {
  console.log(data)
  // return creteOrder(data.order, data.omcId)

  return ReadAndInstantiate(data.omcId).then((result) => {
    console.log(result.qbo)
    return result.qbo.createEstimate(new createQboOrder(data.order, result.config).QboOrder).then((createResult) => {
      /**
       * Only send sn SMS when estimate creation is complete
       * Make the two processes run parallel so that none is blocking
       */
      const EstimateResult = createResult.Estimate as QboOrder
      data.order.QbConfig.EstimateId = EstimateResult.Id
      return Promise.all([ordersms(data.order, data.omcId), validorderupdate(data.order, data.omcId), creteOrder(data.order, data.omcId)])
    });
  })
})
/**
 * create an order from the client directly
 */
exports.createInvoice = functions.https.onCall((data: OrderCreate, context) => {
  console.log(data)
  return ReadAndInstantiate(data.omcId).then((result) => {
    console.log(result.qbo)
    return result.qbo.createInvoice(new createQboOrder(data.order, result.config).QboOrder).then((createResult) => {
      /**
       * Only send sn SMS when invoice creation is complete
       * Make the two processes run parallel so that none is blocking
       */
      const InvoiceResult = createResult.Invoice as QboOrder
      data.order.QbConfig.InvoiceId = InvoiceResult.Id
      data.order.stage = 2
      return Promise.all([ordersms(data.order, data.omcId), validorderupdate(data.order, data.omcId), updateOrder(data.order, data.omcId)]);
    })
  })
})

exports.testSms = functions.https.onCall(() => {
  const opts = {
    method: "post",
    url: "https://ujumbesms.co.ke/api/messaging",
    headers: {
      "X-Authorization": "YWI0YTkzMzUxYTJjYWFjYmU5Zjk2Y2ZkZmZlMDU4",
      "email": "kisinga@zero-q.com",
      Accept: "application/json",
    },
    json: true,
    body: {
      "data": [
        {
          "message_bag": {
            "numbers": "0702604380",
            "message": "Testing test",
            "sender": "SnowPharm"
          }
        }
      ]

    }
  };
  return new Promise(function (resolve, reject) {
    // if (!token) reject('null token')
    requester(opts, function (err, res, body) {
      console.log(JSON.stringify(body, null, 2));

      resolve(body);

    });
  });
})


exports.customerUpdated = functions.firestore
  .document("/omc/{omcId}/customers/{customerId}")
  .onUpdate((snap, context) => {
    console.log(snap);
    const eventID = context.eventId;
    if (isAlreadyRunning(eventID)) {
      console.log(
        "Ignore it because it is already running (eventId):",
        eventID
      );
      return true;
    } else {
      markAsRunning(eventID);
      // A new customer has been updated
      const customerbefore = snap.before.data()
      if (!customerbefore) {
        return true;
      }
      if (customerbefore.QbId === null || customerbefore.QbId === '') {
        // this customer has just been created
        return true;
      }
      const customer = toObject(emptyDaudiCustomer, snap.after)

      return ReadAndInstantiate(context.params.omcId).then(res => {
        return updateCustomer(customer, res.qbo);
      })
    }
  });

/**
 * create a company from the client directly
 */
// exports.createcustomer = functions.https.onCall((data, context) => {
//   const company = data as Customer;
//   console.log(data);
//   return createCustomer(company);
// });
/**
 * Listens to when an sms object has been created in the database and contacts the 3rd party bulk SMS provider
 * @todo Add a callback for when the SMS is successfully sent and possibly when it's read
 */
exports.smscreated = functions.firestore
  .document("/omc/{omcId}/sms/{smsID}")
  .onCreate((data, context) => {
    console.log(data);
    const eventID = context.eventId;
    if (isAlreadyRunning(eventID)) {
      console.log(
        "Ignore it because it is already running (eventId):",
        eventID
      );
      return true;
    }
    markAsRunning(eventID);
    return sendsms(data.data() as SMS, context.params.smsID);
  });
exports.orderUpdated = functions.firestore
  .document("/omc/{omcId}/orders/{orderId}")
  .onUpdate((data, context) => {
    console.log(data);
    const eventID = context.eventId;
    if (isAlreadyRunning(eventID)) {
      console.log(
        "Ignore it because it is already running (eventId):",
        eventID
      );
      return true;
    } else {
      markAsRunning(eventID);

      const order = data.after.data() as Order;
      /**
       * make sure that the stage has increased
       * @todo cater for orders reverted
       */
      const orderbefore = data.before.data() as Order
      if (!orderbefore) {
        return true
      }
      const omcId = context.params.omcId
      if (orderbefore.stage < order.stage) {
        order.Id = data.after.id;
        if (order.notifications.sms) {
          /**
           * Make the two processes run parallel so that none is blocking
           */
          return Promise.all([ordersms(order, omcId), validorderupdate(order, omcId)]);
        } else {
          console.log("Ignoring change in orders not requiring SMS");
          return validorderupdate(order, omcId);
        }
      } else if (orderbefore.truck.stage < orderbefore.truck.stage) {
        // return truckdatachanged(order)
        return true
      } else {
        console.log("Order Info has changed, but stage has not increased");
        return true;
      }
    }
  });

exports.requestsync = functions.https.onCall((data: CompanySync, _) => {
  console.log(data)
  return readQboConfig(data.omcId).then(snapshot => {
    const config = toObject(EmptyQboConfig, snapshot)
    return createQbo(data.omcId, config, true)
      .then((qbo: QuickBooks) => {
        return processSync(data.sync, qbo, data.omcId, config);
      });
  })
})

exports.onUserStatusChanged = functions.database
  .ref("/admins/{uid}")
  .onUpdate((change, context) => {
    // Get the data written to Realtime Database
    const eventStatus = change.after.val();
    const eventID = context.eventId;
    if (isAlreadyRunning(eventID)) {
      console.log(
        "Ignore it because it is already running (eventId):",
        eventID
      );
      return true;
    } else {
      markAsRunning(eventID);
      // Then use other event data to create a reference to the
      // corresponding Firestore document.
      const userStatusFirestoreRef = admin
        .firestore()
        .doc(`admins/${context.params.uid}`);

      // It is likely that the Realtime Database change that triggered
      // this event has already been overwritten by a fast change in
      // online / offline status, so we'll re-read the current data
      // and compare the timestamps.
      return change.after.ref.once("value").then(statusSnapshot => {
        const status = statusSnapshot.val();
        console.log(status, eventStatus);
        return userStatusFirestoreRef.update({
          status: {
            online: status.online,
            time: MyTimestamp.now()
          }
        });
      });
    }
  });

exports.ipnsandbox_db = functions.firestore
  .document("/sandboxpayments/{ipnid}")
  .onCreate((snap, context) => {
    // console.log(snap);
    // A new customer has been updated
    const eventID = context.eventId;
    if (isAlreadyRunning(eventID)) {
      console.log(
        "Ignore it because it is already running (eventId):",
        eventID
      );
      return true;
    }
    markAsRunning(eventID);
    const ipn = snap.data() as EquityBulk;
    return resolveIpn(ipn, context.params.ipnid).then(() => {
      ipn.daudiFields.status = 2;
      return paymentFcm(ipn);
    });
  });
exports.ipnprod_db = functions.firestore
  .document("/prodpayments/{ipnid}")
  .onCreate((snap, context) => {
    // console.log(snap);
    // A new customer has been updated
    const eventID = context.eventId;
    if (isAlreadyRunning(eventID)) {
      console.log(
        "Ignore it because it is already running (eventId):",
        eventID
      );
      return true;
    } else {
      markAsRunning(eventID);
      const ipn = snap.data() as EquityBulk;
      return resolveIpn(ipn, context.params.ipnid).then(() => {
        ipn.daudiFields.status = 2;
        return paymentFcm(ipn);
      });
    }
  });

/**
* a way for the client app to execute a cloud function directly
*/

exports.ipnsandboxcallable = functions.https.onCall((data, context) => {
  const ipn = data as EquityBulk;
  console.log(data);
  return resolveIpn(ipn, ipn.billNumber.toString()).then(() => {
    /**
     * force the fcm to send a payment received msg, because otherwise the new ipn data wont be known
     * unless we make a db read before sending, which at this point is unneccessary
     */
    ipn.daudiFields.status = 2;
    return paymentFcm(ipn);
  });
});

/**
 * a way for the client app to execute a cloud function directly
 */

exports.ipnprodcallable = functions.https.onCall((data, context) => {
  const ipn = data as EquityBulk;
  console.log(data);
  return resolveIpn(ipn, ipn.billNumber.toString()).then(() => {
    /**
     * force the fcm to send a payment received msg, because otherwise the new ipn data wont be known
     * unless we make a db read before sending, which at this point is unneccessary
     */
    ipn.daudiFields.status = 2;
    return paymentFcm(ipn);
  });
});
