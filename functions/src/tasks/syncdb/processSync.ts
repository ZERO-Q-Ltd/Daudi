import { SyncRequest } from "../../models/Cloud/Sync";
import { QuickBooks } from "../../libs/qbmain";
import { syncCustomers } from "./syncCustomers";
import { QbTypes } from "../../models/QbTypes";

export function processSync(sync: SyncRequest, qbo: QuickBooks) {
    return Promise.all(
        sync.synctype.map(async (syncdetail: QbTypes) => {
            switch (syncdetail) {
                case "Customer":
                    console.log("Syncing customers");
                    return await syncCustomers(qbo);
                case "Employee":
                    console.log("Syncing employees");
                    return true;
                // return await syncAdmins(qbo);
                case "Item":
                    console.log("Syncing Items zote");
                    return true;
                // return await syncItems(qbo);
                case "BillPayment":
                    console.log("Syncing batches");
                    return true;
                // return await syncBatches(qbo, sync.time);
                default:
                    console.log("Unrecognized object for syncdetected, breaking");
                    return true;
            }
        })
    );
}