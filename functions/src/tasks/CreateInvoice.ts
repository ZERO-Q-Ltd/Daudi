import { QuickBooks } from "../libs/qbmain";
import { QboCofig } from "../models/Cloud/QboEnvironment";
import { Order } from "../models/Daudi/order/Order";
import { Payment } from "../models/Qbo/Payment";
import { Invoice_Estimate } from "../models/Qbo/QboOrder";
import { validOrderUpdate } from "../validators/orderupdate";
import { updateOrder } from "./crud/daudi/Order";
import { QboOrder } from "./crud/qbo/Order/create";
import { ordersms } from "./sms/smscompose";

export function CreateInvoice(qbo: QuickBooks, config: QboCofig, omcId: string, order: Order) {
    return qbo.createInvoice(new QboOrder(order, config).QboOrder).then((createResult) => {
        /**
         * Only send sn SMS when invoice creation is complete
         */
        const InvoiceResult = createResult.Invoice as Invoice_Estimate;
        order.QbConfig.InvoiceId = InvoiceResult.Id;
        order.QbConfig.InvoiceNumber = InvoiceResult.DocNumber || null;
        // order.stage = 2;
        return qbo.findPayments([
            { field: "CustomerRef", value: order.customer.QbId, operator: "=" },
            { field: "limit", value: 20 }
        ]).then(async value => {
            const queriedpayments = value.QueryResponse.Payment || [];
            let invoicefullypaid = false;
            const validpayments: Array<{ payment: Payment, amount: number; }> = [];
            let totalunapplied = 0;

            queriedpayments.forEach(payment => {
                totalunapplied += payment.UnappliedAmt;
                if (totalunapplied < InvoiceResult.TotalAmt) {
                    totalunapplied += payment.UnappliedAmt;
                    validpayments.push({
                        payment,
                        amount: payment.UnappliedAmt
                    });
                } else {
                    console.log("Unused payments enough to pay for invoice");
                    if (!invoicefullypaid) {
                        validpayments.push({
                            payment,
                            // amount: (totalunapplied < invoiceresult.TotalAmt ? payment.UnappliedAmt : totalunapplied - invoiceresult.TotalAmt)
                            amount: payment.UnappliedAmt
                        });
                        invoicefullypaid = true;
                    } else {
                        console.log("Accumulated unused payments already enough, skipping....");
                        return;
                    }
                }
            });

            if (validpayments.length > 0) {
                console.log(`Company has ${validpayments.length} unused payments`);
                // console.log(validpayments);
                /**
                  * This part needs to be blocking so that we dont get concurrent errors when
                  * Udating the same payment multiple times
                  */
                for await (const paymentdetial of validpayments) {
                    paymentdetial.payment.Line.push({
                        Amount: paymentdetial.amount,
                        LinkedTxn: [{
                            TxnId: InvoiceResult.Id,
                            TxnType: "Invoice"
                        }]
                    });
                    return qbo.updatePayment(paymentdetial.payment);
                }
                console.log("Done updating payments");
                order.stage = invoicefullypaid ? 3 : 2;
                order.orderStageData[3] = {
                    user: {
                        adminId: null,
                        date: new Date(),
                        name: "QBO"
                    }
                };
                return Promise.all([ordersms(order, omcId), validOrderUpdate(order, omcId), updateOrder(order, omcId)]);
            } else {
                console.log("Company doesn't have unused payments");
                order.stage = 2;
                return Promise.all([ordersms(order, omcId), validOrderUpdate(order, omcId), updateOrder(order, omcId)]);
            }
        });

    });
}