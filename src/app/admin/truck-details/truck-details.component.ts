import { Component, EventEmitter, OnDestroy, OnInit } from "@angular/core";
import { emptytruck, Truck_ } from "../../models/Truck";
import { Order_ } from "../../models/Order";
import { TrucksService } from "../services/trucks.service";
import * as moment from "moment";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";
import { Options } from "ng5-slider";
import { NotificationService } from "../../shared/services/notification.service";
import { BatchesSelectorComponent } from "../batches-selector/batches-selector.component";
import { OrdersService } from "../services/orders.service";
import { AdminsService } from "../services/admins.service";
import { ComponentCommunicationService } from "../services/component-communication.service";
import { MatDialog } from "@angular/material";
import { AngularFirestore } from "@angular/fire/firestore";
import { takeUntil } from "rxjs/operators";
import { ReplaySubject } from "rxjs";
import { firestore } from "firebase";


@Component({
  selector: "truck-details",
  templateUrl: "./truck-details.component.html",
  styleUrls: ["./truck-details.component.scss"]
})
export class TruckDetailsComponent implements OnInit, OnDestroy {
  order: Order_;
  clickedtruck: Truck_ = { ...emptytruck };
  loadingtruck = false;
  position = "above";

  dialogProperties: object = {};
  position1 = "before";
  position2 = "after";
  position3 = "below";
  accuracycolors = {
    1: {
      percentage: 0
    },
    2: {
      percentage: 0
    },
    3: {
      percentage: 0
    }
  };
  manualRefresh: EventEmitter<void> = new EventEmitter<void>();
  slider: Options = {
    floor: -1,
    ceil: 1,
    showSelectionBarFromValue: 0,
    step: 0.1,
    readOnly: true,
    // showTicks: true,
    getPointerColor: (value: number): string => {
      const scale = Math.round(Math.abs(value) * 5);
      // console.log(scale, value);
      switch (scale) {
        case 5:
          return "#FF003C";
        case 4:
          return "#FF8A00";
        case 3:
          return "#FABE28";
        case 2:
          return "#c1ba2e";
        case 1:
          return "#b9e615";
        case 0:
          return "#2bb418";
        default:
          return "#FF003C";

      }
    },
    getSelectionBarColor: (value: number): string => {
      const scale = Math.round(Math.abs(value) * 5);
      // console.log(scale, value);
      switch (scale) {
        case 5:
          return "#FF003C";
        case 4:
          return "#FF8A00";
        case 3:
          return "#FABE28";
        case 2:
          return "#c1ba2e";
        case 1:
          return "#b9e615";
        case 0:
          return "#2bb418";
        default:
          return "#FF003C";
      }
    }
  };

  /**
   * this keeps a local copy of all the subscriptions within this service
   */
  subscriptions: Map<string, any> = new Map<string, any>();
  comopnentDestroyed: ReplaySubject<boolean> = new ReplaySubject<boolean>();

  constructor(public db: AngularFirestore,
    private truckservice: TrucksService,
    private notification: NotificationService,
    private orderservice: OrdersService,
    private adminservice: AdminsService,
    private dialog: MatDialog,
    private componentcommunication: ComponentCommunicationService) {
    this.componentcommunication.clickedorder.pipe(takeUntil(this.comopnentDestroyed)).subscribe(order => {
      if (!order) {
        return;
      }
      this.order = order;
      this.gettruck();
    });

  }

  ngOnDestroy(): void {
    this.comopnentDestroyed.next(true);
    this.unsubscribeAll();
  }

  unsubscribeAll() {
    this.subscriptions.forEach(value => {
      value();
    });
  }

  gettruck() {
    this.loadingtruck = true;
    if (!this.order.Id) {
      return;
    }
    const subscription = this.truckservice.getTruck(this.order.Id)
      .onSnapshot(truck => {
        this.clickedtruck = truck.data() as Truck_;
        if (truck.exists) {
          this.clickedtruck.Id = truck.id;
        } else {
          console.log("error fetching truck");
        }
        /**
         * Deliberately delay the operation to make the animation amooth
         */
        setTimeout(() => {
          this.loadingtruck = false;
          return;
        }, 700);
      });
    this.subscriptions.set(`truck`, subscription);
  }

  timespent(start, stop) {
    const difference = moment(stop.toDate()).diff(moment(start.toDate()));
    const timediff = moment.duration(difference);
    // console.log(timediff.hours(), timediff.minutes());
    const totalhours = moment.duration(timediff).hours() > 9 ? moment.duration(timediff).hours() : "0" + moment.duration(timediff).hours();
    const totalmins = moment.duration(timediff).minutes() > 9 ? moment.duration(timediff).minutes() : "0" + moment.duration(timediff).minutes();
    return `${totalhours}:${totalmins}:00`;
  }

  expired(timestamp) {
    if (!timestamp || !(timestamp instanceof firestore.Timestamp)) {
      return;
    }
    return timestamp.toDate() < moment().toDate();
  }

  /**
   *
   * @param truck
   */
  freezetruck(truck: Truck_) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent,
      {
        role: "dialog",
        data: truck.frozen ? "Are you sure?" : "Freeze this truck? This will disable modifications from the app"
      });
    dialogRef.afterClosed().pipe(takeUntil(this.comopnentDestroyed)).subscribe(result => {
      if (result) {
        this.truckservice.updatetruck(truck.Id).update(truck).then(value => {
          this.notification.notify({
            body: "Saved",
            alert_type: "success",
            title: "Success",
            duration: 2000
          });
        });
      }
    });
  }

  resolvetime(timestamp) {
    if (timestamp) {
      return moment(timestamp.toDate()).fromNow();
    }
  }


  calculatetotaltime(timearray: Array<any>) {
    let totaltime: any = "00:00:00";

    timearray.forEach(timeobject => {
      totaltime = moment.duration(totaltime).add(timeobject.time);
    });
    const totalhours = moment.duration(totaltime).hours() > 9 ? moment.duration(totaltime).hours() : "0" + moment.duration(totaltime).hours();
    const totalmins = moment.duration(totaltime).minutes() > 9 ? moment.duration(totaltime).minutes() : "0" + moment.duration(totaltime).minutes();
    return `${totalhours}:${totalmins}:00`;
  }

  calculateaccuracy(timearray, start, stop, stage) {
    const totalestime = this.calculatetotaltime(timearray);
    const totaltimespent = this.timespent(start, stop);
    const diff = moment.duration(totalestime).subtract(totaltimespent).asMilliseconds();
    // console.log(diff, moment.duration(totaltimespent).asMilliseconds(), moment.duration(totalestime).asMilliseconds());
    // console.log(diff / moment.duration(totaltimespent).asMilliseconds() * 100);

    const percentage = diff / moment.duration(totalestime).asMilliseconds();
    // console.log(this.accuracycolors[stage]);
    if (this.accuracycolors[stage].percentage !== percentage) {
      this.accuracycolors[stage].percentage = percentage;
      setTimeout(() => {
        // console.log('Emmiting change');
        this.manualRefresh.emit();
        return;
      }, 100);
    }

    return true;
  }

  approveTruck() {
    const dialogRef = this.dialog.open(BatchesSelectorComponent, {
      role: "dialog",
      data: this.clickedtruck.Id,
      width: "80%"
    });

  }


  deleteTruck() {
    const dialogRef = this.dialog.open(ConfirmDialogComponent,
      {
        role: "dialog",
        data: "DELETE THIS TRUCK? \n THIS CANNOT BE REVERSED!!"
      });
    dialogRef.afterClosed().pipe(takeUntil(this.comopnentDestroyed)).subscribe(result => {
      if (result) {
        this.componentcommunication.truckDeleted.next(true);
        this.order.loaded = false;
        const batchaction = this.db.firestore.batch();
        batchaction.update(this.orderservice.updateorder(this.clickedtruck.Id), this.order);
        batchaction.delete(this.truckservice.updatetruck(this.clickedtruck.Id));
        batchaction.commit().then(result => {
          /**
           * unsubscribe after truck is deleted
           */
          this.subscriptions.get(`truck`)();
          this.componentcommunication.clickedorder.next(null);

          this.notification.notify({
            body: "Truck deleted",
            title: "Deleted",
            alert_type: "warning",
            duration: 2000
          });
        });
      }

    });
  }


  /**
   *
   * @param truck
   */
  resetTruck(truck: Truck_) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent,
      {
        role: "dialog",
        data: "RESET THIS TRUCK? \n This will allow modifications to be done to the Truck Details on the App!!"
      });
    dialogRef.afterClosed().pipe(takeUntil(this.comopnentDestroyed)).subscribe(result => {
      if (result) {
        truck.stagedata[1].user = this.adminservice.createuserobject();
        truck.stagedata[1].data.expiry = [{ time: "00:45:00", timestamp: moment().add(45, "minutes").toDate() }];
        truck.stagedata[2].data.expiry = [];
        truck.stagedata[3].data.expiry = [];
        truck.isPrinted = false;
        // @ts-ignore
        truck.isprinted = false;
        truck.stage = 1;
        this.truckservice.updatetruck(truck.Id).update(truck).then(value => {
          this.notification.notify({
            body: "Truck reset",
            alert_type: "success",
            title: "Success",
            duration: 2000
          });
        });
      }
    });
  }


  getcolor(stage) {
    return this.accuracycolors[stage];
  }


  ngOnInit() {
  }

}
