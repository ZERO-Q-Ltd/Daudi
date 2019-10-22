import { Admin_ } from "../../models/Daudi/Admin";
import { firestore, messaging } from "firebase-admin";
import { ipnmodel } from "../../models/common";
import { Fcm } from "../../models/Cloud/Fcm";

export function paymentFcm(ipn: ipnmodel) {
  console.log("sending payment FCM");
  let message: Fcm;
  /**
   * TODO : use settings to make query and differentiate different fcms
   */
  if (ipn.daudiFields.status === 0) {
    message = {
      notification: {
        title: "Payment Received",
        body: `of ${ipn.billAmount} for ${ipn.billNumber}. It will automatically be applied`,
        icon: "https://emkaynow.com/favicon.ico"
      }
    };
  } else {
    message = {
      notification: {
        title: "Unprocessed Payment",
        body: `of ${ipn.billAmount} Please validate this payment`,
        icon: "https://emkaynow.com/favicon.ico"
      }
    };
  }
  return getallallowedAdmins().then(adminsobject => {
    return Promise.all(
      adminsobject.docs
        .filter(rawadmindata => {
          const admin = rawadmindata.data() as Admin_;
          /**
           * Only users permitted to view sandbox can receive sandbox payments
           * Only users below level 3 can receive payment notifications
           * It is mandatory that the users have tokens
           */
          if (ipn.daudiFields.sandbox) {
            return (
              Number(admin.config.level) < 3 &&
              admin.config.viewsandbox &&
              admin.fcmtokens &&
              admin.fcmtokens.web
            );
          } else {
            return (
              Number(admin.config.level) < 3 &&
              admin.fcmtokens &&
              admin.fcmtokens.web
            );
          }
        })
        .map(async rawadmindata => {
          const admin = rawadmindata.data() as Admin_;
          console.log("sending to", admin);
          return messaging().sendToDevice(admin.fcmtokens.web, message);
        })
    );
  });
}

function getallallowedAdmins() {
  //`settings.fcm.payment.live`, '===', true
  // return firestore().collection('admins').get();
  return firestore()
    .collection("admins")
    .get();
}

//Unprocessed Payment
