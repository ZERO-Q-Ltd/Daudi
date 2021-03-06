import { Component, OnInit, ViewChild } from "@angular/core";
import { MatSort } from "@angular/material/sort";
import { MatTableDataSource } from "@angular/material/table";
import { CoreService } from "app/services/core/core.service";
import { BehaviorSubject, ReplaySubject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { Depot, emptydepot } from "../../models/Daudi/depot/Depot";
import { DepotConfig, emptyDepotConfig } from "../../models/Daudi/depot/DepotConfig";
import { Price } from "../../models/Daudi/depot/Price";
import { FuelNamesArray, FuelType } from "../../models/Daudi/fuel/FuelType";

@Component({
  selector: "app-price-comparison",
  templateUrl: "./price-comparison.component.html",
  styleUrls: ["./price-comparison.component.scss"]
})
export class PriceComparisonComponent implements OnInit {
  @ViewChild(MatSort, { static: true }) sort: MatSort;

  depotsdataSource = new MatTableDataSource<Depot>();
  comopnentDestroyed: ReplaySubject<boolean> = new ReplaySubject<boolean>();
  fueltypesArray = FuelNamesArray;
  priceColumns = ["depot", "pms_price", "pms_avgprice", "ago_price", "ago_avgprice", "ik_price", "ik_avgprice"];
  activedepot: { depot: Depot, config: DepotConfig } = { depot: { ...emptydepot }, config: { ...emptyDepotConfig } };

  avgprices: {
    [key in FuelType]: {
      total: BehaviorSubject<number>,
      avg: BehaviorSubject<number>,
      prices: BehaviorSubject<Price[]>
    }
  } = {
      pms: {
        total: new BehaviorSubject<number>(0),
        avg: new BehaviorSubject<number>(0),
        prices: new BehaviorSubject<Price[]>([])
      },
      ago: {
        total: new BehaviorSubject<number>(0),
        avg: new BehaviorSubject<number>(0),
        prices: new BehaviorSubject<Price[]>([])
      },
      ik: {
        total: new BehaviorSubject<number>(0),
        avg: new BehaviorSubject<number>(0),
        prices: new BehaviorSubject<Price[]>([])
      }
    };

  constructor(
    private core: CoreService,
  ) {

    this.core.depots
      .pipe(takeUntil(this.comopnentDestroyed))
      .subscribe((value) => {
        this.depotsdataSource.data = value.filter((n) => n);
      });
  }

  ngOnInit() {
  }

  ngAfterViewInit() {
    this.depotsdataSource.sort = this.sort;
  }

  ngOnDestroy(): void {
    this.comopnentDestroyed.next(true);
    this.unsubscribeAll();
  }

  unsubscribeAll() {

  }

}
