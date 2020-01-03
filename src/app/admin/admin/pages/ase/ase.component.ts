import { Component, OnInit, ViewChild } from "@angular/core";
import { AngularFireFunctions } from "@angular/fire/functions";
import { MatPaginator, MatTableDataSource } from "@angular/material";
import { ReplaySubject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { SyncRequest } from "../../../../models/Cloud/Sync";
import { ASE, emptyASEs } from "../../../../models/Daudi/fuel/ASE";
import { FuelNamesArray, FuelType } from "../../../../models/Daudi/fuel/FuelType";
import { MyTimestamp } from "../../../../models/firestore/firestoreTypes";
import { NotificationService } from "../../../../shared/services/notification.service";
import { AseService } from "../../../services/ase.service";
import { ConfigService } from "../../../services/core/config.service";
import { DepotService } from "../../../services/core/depot.service";
import { CoreService } from "../../../services/core/core.service";

@Component({
  selector: "app-ase",
  templateUrl: "./ase.component.html",
  styleUrls: ["./ase.component.scss"]
})
export class AseComponent implements OnInit {
  fueltypesArray = FuelNamesArray;
  datasource = {
    pms: new MatTableDataSource<ASE>(),
    ago: new MatTableDataSource<ASE>(),
    ik: new MatTableDataSource<ASE>()
  };
  creatingsync = false;
  @ViewChild(MatPaginator, { static: true }) pmspaginator: MatPaginator;
  @ViewChild(MatPaginator, { static: true }) agopaginator: MatPaginator;
  @ViewChild(MatPaginator, { static: true }) ikpaginator: MatPaginator;
  displayedColumns: string[] = ["id", "date", "entry", "totalqty", "transferred", "accumuated", "loadedqty", "availableqty", "status"];
  loading: {
    pms: boolean,
    ago: boolean,
    ik: boolean
  } = {
      pms: true,
      ago: true,
      ik: true
    };
  availablefuel: {
    pms: number,
    ago: number,
    ik: number
  } = {
      pms: 0,
      ago: 0,
      ik: 0
    };

  /**
   * this keeps a local copy of all the subscriptions within this service
   */
  subscriptions: Map<string, any> = new Map<string, any>();
  comopnentDestroyed: ReplaySubject<boolean> = new ReplaySubject<boolean>();

  constructor(
    private depotsservice: DepotService,
    private notification: NotificationService,
    private functions: AngularFireFunctions,
    private core: CoreService,
    private aseService: AseService) {
    this.core.activedepot.pipe(takeUntil(this.comopnentDestroyed)).subscribe(depotvata => {
      this.loading = {
        pms: true,
        ago: true,
        ik: true
      };

      if (depotvata.depot.Id) {
        this.fueltypesArray.forEach((fueltype: FuelType) => {
          /**
           * Create a subscrition for 1000 batches history
           */
          const subscription = this.aseService.getASEs(this.core.currentOmc.value.Id, fueltype).limit(100)
            .onSnapshot(snapshot => {
              this.loading[fueltype] = false;
              this.datasource[fueltype].data = snapshot.docs.map(ase => {
                const value: ASE = Object.assign({}, emptyASEs, ase.data()) as any;
                value.Id = ase.id;
                return value;
              });
            });
          this.subscriptions.set(`batches`, subscription);
          /**
           * Because all these batches might take time to load, take the totals
           * from the already loaded batches within that depot
           */
          // this.core.depotASEs[fueltype]
          //   .pipe(takeUntil(this.comopnentDestroyed))
          //   .subscribe((ases: Array<ASE>) => {
          //     /**
          //      * Reset the values every time batches change
          //      */
          //     this.availablefuel[fueltype] = 0;
          //     ases.forEach(ase => {
          //       this.availablefuel[fueltype] += this.getTotalAvailable(ase);
          //     });
          //   });
        });
      }
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

  syncdb() {
    this.creatingsync = true;
    const syncobject: SyncRequest = {
      time: MyTimestamp.now(),
      synctype: ["BillPayment"]
    };

    this.functions.httpsCallable("requestsync")(syncobject).subscribe(res => {
      this.creatingsync = false;
      this.notification.notify({
        alert_type: "success",
        body: "ASE's updated",
        title: "Success"
      });
    });
  }

  getTotalAvailable(batch: ASE) {
    // const totalqty = batch.qty.total;
    // const totalLoaded = batch.qty.directLoad.total + batch.qty.transferred.total;
    // return totalqty - totalLoaded;
    return 0;
  }

  ngOnInit() {
    this.datasource.pms.paginator = this.pmspaginator;
    this.datasource.ago.paginator = this.agopaginator;
    this.datasource.ik.paginator = this.ikpaginator;
  }

  filterbatches(fueltype: string, filterValue: string) {
    filterValue = filterValue.trim(); // Remove whitespace
    filterValue = filterValue.toLowerCase(); // MatTableDataSource defaults to lowercase matches
    this.datasource[fueltype].filter = filterValue;
  }
}