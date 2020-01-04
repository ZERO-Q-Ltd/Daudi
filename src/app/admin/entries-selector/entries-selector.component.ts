import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { AngularFirestore } from "@angular/fire/firestore";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material";
import * as moment from "moment";
import { ReplaySubject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { Depot, emptydepot } from "../../models/Daudi/depot/Depot";
import { DepotConfig, emptyDepotConfig } from "../../models/Daudi/depot/DepotConfig";
import { Entry } from "../../models/Daudi/fuel/Entry";
import { FuelNamesArray, FuelType } from "../../models/Daudi/fuel/FuelType";
import { EmptyOMCStock, OMCStock } from "../../models/Daudi/omc/Stock";
import { emptyorder, Order } from "../../models/Daudi/order/Order";
import { Stage1Model } from "../../models/Daudi/order/truck/TruckStages";
import { MyTimestamp } from "../../models/firestore/firestoreTypes";
import { NotificationService } from "../../shared/services/notification.service";
import { AdminService } from "../services/core/admin.service";
import { ConfigService } from "../services/core/config.service";
import { CoreService } from "../services/core/core.service";
import { EntriesService } from "../services/entries.service";
import { OrdersService } from "../services/orders.service";

interface EntryContent {
  id: string;
  qtydrawn: number;
  name: string;
  totalqty: number;
  /**
   * @description the amount that will remail
   */
  remainqty: number;
  resultstatus: boolean;
}

@Component({
  selector: "app-entries-selector",
  templateUrl: "./entries-selector.component.html",
  styleUrls: ["./entries-selector.component.scss"]
})


export class EntriesSelectorComponent implements OnInit, OnDestroy {
  depotEntries: {
    pms: Array<Entry>,
    ago: Array<Entry>,
    ik: Array<Entry>
  } = {
      pms: [],
      ago: [],
      ik: []
    };
  displayedColumns: string[] = ["id", "batch", "totalqty", "accumulated", "loadedqty", "availableqty", "drawnqty", "remainingqty", "status"];

  drawnEntry: {
    [key in FuelType]: EntryContent[]
  } = {
      pms: [],
      ago: [],
      ik: [],
    };
  fuelerror: {
    [key in FuelType]: { status: boolean, errorString: string }
  } = {
      ago: { status: false, errorString: null },
      ik: { status: false, errorString: null },
      pms: { status: false, errorString: null }
    };
  saving = false;
  order: Order = { ...emptyorder };
  donecalculating = false;
  fueltypesArray = FuelNamesArray;
  fetchingEntries: boolean;
  comopnentDestroyed: ReplaySubject<boolean> = new ReplaySubject<boolean>();
  /**
   * this keeps a local copy of all the subscriptions within this service
   */
  subscriptions: Map<string, () => void> = new Map<string, any>();
  stock: OMCStock = { ...EmptyOMCStock };
  activedepot: { depot: Depot, config: DepotConfig } = { depot: { ...emptydepot }, config: { ...emptyDepotConfig } };

  constructor(
    public dialogRef: MatDialogRef<EntriesSelectorComponent>,
    @Inject(MAT_DIALOG_DATA) private orderId: string,
    private notification: NotificationService,
    private db: AngularFirestore,
    private adminservice: AdminService,
    private core: CoreService,
    private entriesService: EntriesService,
    private configService: ConfigService,
    private ordersservice: OrdersService) {
    this.fueltypesArray.forEach((fueltype: FuelType) => {
      this.core.depotEntries[fueltype]
        .pipe(takeUntil(this.comopnentDestroyed))
        .subscribe((entries: Array<Entry>) => {
          // console.log(entries);
          this.depotEntries[fueltype] = entries;
          /**
           * make sure the config exists before making any calculations,
           * otherwise wait for fetching config trigger making calculations
           */
          if (this.stock) {
            this.calculateqty();
          }
        });
    });
    this.core.loaders.entries.pipe(takeUntil(this.comopnentDestroyed)).subscribe(value => {
      this.fetchingEntries = value;
    });

    this.core.stock.pipe(takeUntil(this.comopnentDestroyed)).subscribe(stock => {
      this.stock = stock;
      this.calculateqty();
    });
    const ordersubscription = this.ordersservice.getOrder(orderId, core.currentOmc.value.Id)
      .onSnapshot(orderSnapshot => {
        if (orderSnapshot.exists) {
          this.order = Object.assign({}, orderSnapshot.data()) as Order;
          this.order.Id = orderSnapshot.id;
        } else {
          this.order = Object.assign({}, emptyorder);
        }
        /**
         * make sure the config exists before making any calculations,
         * otherwise wait for fetching config trigger making calculations
         */
        if (this.stock) {
          this.calculateqty();
        }
      });
    this.subscriptions.set(`order`, ordersubscription);

  }

  unsubscribeAll() {
    this.subscriptions.forEach(value => {
      value();
    });
  }

  ngOnDestroy(): void {
    this.comopnentDestroyed.next(true);
    this.unsubscribeAll();
  }

  calculateqty() {
    this.donecalculating = false;
    this.fueltypesArray.forEach((fueltype: FuelType) => {
      this.fuelerror[fueltype].status = false;
      /**
       * Check if its a private depot as calculations will use the local depot values
       * Entries are already filtered for private depots, so calculations are the same
       */
      const value = this.core.activedepot.value.depot.config.private ?
        this.activedepot.config.stock[fueltype].ase.available : this.stock.qty[fueltype].ase.available;

      /**
       * check if there is enough ASE for that fuel
       */
      if (value >= this.order.fuel[fueltype].qty) {

        /**
         * Check if there are batches to assign
         */
        if ((this.depotEntries[fueltype].length > 0) && (this.order.fuel[fueltype].qty > 0)) {
          /**
           * Check if there is a rollover in the batches
           */
          if (this.getTotalAvailableEntry(0, fueltype) >= this.order.fuel[fueltype].qty) {
            this.drawnEntry[fueltype][0] = {
              id: this.depotEntries[fueltype][0].Id,
              /**
               * Since there is only 1 batch to be assigned, the new qty is direct
               */
              qtydrawn: this.order.fuel[fueltype].qty,
              name: this.depotEntries[fueltype][0].entry.name,
              totalqty: this.depotEntries[fueltype][0].qty.total,
              resultstatus: this.getTotalAvailableEntry(0, fueltype) > this.order.fuel[fueltype].qty,
              remainqty: this.getTotalAvailableEntry(0, fueltype) - this.order.fuel[fueltype].qty
            };
            this.donecalculating = true;

          } else {
            /**
             * Loop through all the batches to get the next available batch number that will be able to completely fill the truck
             */
            let batch1: EntryContent = {
              id: null,
              qtydrawn: 0,
              name: null,
              totalqty: 0,
              resultstatus: true,
              remainqty: 0
            };
            /**
             * The value that should e deducted as a result of assigning the first batch number
             */
            const assignedamount = this.getTotalAvailableEntry(0, fueltype);

            this.depotEntries[fueltype].forEach((batch: Entry, index) => {
              /**
               * Check if there is fuel to rollover
               */
              if (this.depotEntries[fueltype].length < 2) {
                this.fuelerror[fueltype] = {
                  errorString: `Insufficient ${fueltype.toUpperCase()}ENTRY. Expected amount is ${this.order.fuel[fueltype].qty}`,
                  status: true
                };
                return;
              }
              /**
               * Start at pos 1 because pos 0 MUST be used in batch0
               */
              if (index > 0) {
                /**
                 * Check if the batch number at that position has enough fuel to be assigned, otherwise error
                 */
                if (this.getTotalAvailableEntry(index, fueltype) >= (this.order.fuel[fueltype].qty - assignedamount)) {
                  /**
                   * Only assign a batch if not already containing a value, hence have affinity for the order of display as the second assigned batch
                   */
                  if (!batch1.id) {
                    /**
                     * remove the error in case it was caused by a batch within the loop not being enough
                     * If all the batches are not enough it will remain true
                     */
                    this.fuelerror[fueltype].status = false;
                    const qtydrawn = this.order.fuel[fueltype].qty - assignedamount;
                    batch1 = {
                      id: batch.Id,
                      qtydrawn,
                      name: batch.entry.name,
                      totalqty: batch.qty.total,
                      resultstatus: this.getTotalAvailableEntry(index, fueltype) > assignedamount,
                      remainqty: this.getTotalAvailableEntry(index, fueltype) - qtydrawn
                    };
                  }
                } else {
                  /**
                   * Olny set error if batch 1 doesnt exist
                   */
                  if (!batch1.id) {
                    this.fuelerror[fueltype] = {
                      errorString: `Insufficient ${fueltype.toUpperCase()} ENTRY. Expected amount is ${this.order.fuel[fueltype].qty}`,
                      status: true
                    };
                  }
                }
              }
            });
            if (!batch1) {
              this.fuelerror[fueltype] = {
                errorString: `Insufficient ${fueltype.toUpperCase()} ENTRY.Expected amount is ${this.order.fuel[fueltype].qty}`,
                status: true
              };
            }
            this.drawnEntry[fueltype] = [{
              id: this.depotEntries[fueltype][0].Id,
              /**
               * the qty drown
               */
              qtydrawn: this.getTotalAvailableEntry(0, fueltype),
              name: this.depotEntries[fueltype][0].entry.name,
              totalqty: this.depotEntries[fueltype][0].qty.total,
              resultstatus: false,
              remainqty: 0
            }, batch1];
            this.donecalculating = true;

          }
        } else {
          this.donecalculating = true;
          if (this.order.fuel[fueltype].qty > 0 && this.depotEntries[fueltype].length === 0) {
            this.fuelerror[fueltype] = {
              errorString: `Insufficient ${fueltype.toUpperCase()} ENTRY. Expected amount is ${this.order.fuel[fueltype].qty}`,
              status: true
            };
          }
        }
      } else {
        this.donecalculating = true;
        this.fuelerror[fueltype] = {
          errorString: `Insufficient ${fueltype.toUpperCase()} ASE. Expected amount is ${this.order.fuel[fueltype].qty}`,
          status: true
        };
      }

      // console.log(this.drawnbatch)

    });
  }
  /**
   * Returns the total available fuel within an entry
   * We used the index because it is the crucial element when working with rollovers
   * @param index of the Entry within the depot entries array
   * @param fueltype fueltype of the ASE
   */
  getTotalAvailableEntry(index: number, fueltype: FuelType) {
    return this.depotEntries[fueltype][index].qty.total - this.depotEntries[fueltype][index].qty.used;
  }
  /**
   * Returns the total available fuel within an ASE
   * We used the index because it is the crucial element when working with rollovers
   * @param index of the Entry within the depot entries array
   * @param fueltype fueltype of the ASE
   */

  /***
   *
   */
  approvetruck(): void {
    this.saving = true;
    this.dialogRef.disableClose = true;
    let HasError = false;
    this.fueltypesArray.forEach((fueltype: FuelType) => {

      if (this.fuelerror[fueltype].status) {
        this.saving = false;
        this.dialogRef.disableClose = false;
        HasError = true;
        return this.notification.notify({
          alert_type: "error",
          title: `Error`,
          body: this.fuelerror[fueltype].errorString,
          duration: 6000
        });
      } else {
        this.order.fuel[fueltype].entries = [];
      }
    });

    if (!HasError) {
      const data: Stage1Model = {
        user: this.adminservice.createuserobject(),
        expiry: [
          {
            timeCreated: MyTimestamp.now(),
            expiry: MyTimestamp.fromDate(moment().add(45, "minutes").toDate()),
          }],
        print: {
          status: false,
          timestamp: MyTimestamp.now()
        }
      };
      this.order.stage = 4;
      this.order.loaded = true;

      this.order.stagedata["4"].user = data.user;

      this.order.truck.stagedata["1"] = data;
      this.order.stage = 1;

      const batchaction = this.db.firestore.batch();
      batchaction.update(this.ordersservice.ordersCollection(this.core.currentOmc.value.Id).doc(this.orderId), this.order);
      this.fueltypesArray.forEach((fueltype: FuelType) => {
        /**
         * check if the truck contained that fueltype
         */
        if (this.order.fuel[fueltype].qty > 0) {
          /**
           * check if two batch numbers have been assigned to the truck for that fueltype
           */
          if (this.order.fuel[fueltype].entries[0].qty > 0) {
            /**
             * Update the batch number quantity and disable the batch
             * A max of 2 batch numbers may be assigned to the truck
             */
            this.depotEntries[fueltype][0].qty.directLoad = {
              total: this.depotEntries[fueltype][0].qty.total,
              accumulated: {
                usable: 0,
                total: this.depotEntries[fueltype][0].qty.directLoad.accumulated.total
              },
            };
            /**
             * Deactivate this entry since we're sure a second once has been assigned
             */
            this.depotEntries[fueltype][0].active = false;
            batchaction.update(this.entriesService.entryCollection(this.core.currentOmc.value.Id)
              .doc(this.order.fuel[fueltype].entries[0].Id), this.depotEntries[fueltype][0]);

            /**
             * update the secoond Entry quantities
             */
            this.depotEntries[fueltype][1].qty.directLoad = {
              total: this.depotEntries[fueltype][1].qty.total - this.drawnEntry[fueltype][1].remainqty,
              accumulated: {
                usable: 0,
                total: this.depotEntries[fueltype][1].qty.directLoad.accumulated.total
              },
            };
            /**
             * Leave the second entry active if neccessary
             */
            this.depotEntries[fueltype][1].active = this.depotEntries[fueltype][1].qty.total - this.drawnEntry[fueltype][1].remainqty > 0;
            batchaction.update(this.entriesService.entryCollection(this.core.currentOmc.value.Id)
              .doc(this.order.fuel[fueltype].entries[1].Id), this.depotEntries[fueltype][0]);
          } else {
            /**
             * Only one batch number assigned, hence leave it active
             */
            this.depotEntries[fueltype][0].qty.directLoad = {
              total: this.depotEntries[fueltype][0].qty.total + this.order.fuel[fueltype].entries[0].qty,
              accumulated: {
                usable: 0,
                total: this.depotEntries[fueltype][0].qty.directLoad.accumulated.total
              },
            };
            batchaction.update(this.ordersservice.ordersCollection(this.core.currentOmc.value.Id).doc(this.orderId), this.order);
            /**
             * Update Global ASE values
             * Check if it's a private depot
             */
            if (this.core.activedepot.value.depot.config.private) {
              this.activedepot.config.stock[fueltype].ase.available = this.activedepot.config.stock[fueltype].ase.available - this.order.fuel[fueltype].qty;
              batchaction.update(this.configService.configCollection(this.core.currentOmc.value.Id), this.activedepot.config);
            } else {
              this.stock.qty[fueltype].ase.available = this.stock.qty[fueltype].ase.available - this.order.fuel[fueltype].qty;
              batchaction.update(this.configService.stockCollection(this.core.currentOmc.value.Id), this.stock);
            }
          }
        }
      });
      batchaction.commit().then(value => {
        this.notification.notify({
          alert_type: "success",
          title: "Success",
          body: `Truck Approved`
        });
        this.dialogRef.close();
      });
    }

  }

  ngOnInit() {
  }

}
