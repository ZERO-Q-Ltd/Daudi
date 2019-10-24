import { Component, OnDestroy } from "@angular/core";
import { orderStagesarray } from "../../../../models/Order";
import { truckStagesarray } from "../../../../models/Truck";
import { OrdersService } from "../../../services/orders.service";
import { TrucksService } from "../../../services/trucks.service";
import { ReplaySubject } from "rxjs";
import { takeUntil } from "rxjs/operators"; // get our service
import { DepotsService } from "../../../services/core/depots.service";
import { Depot, emptydepot } from "../../../../models/Depot";

@Component({
  selector: "my-app-sidenav-menu",
  styles: [],
  templateUrl: "./sidenav-menu.component.html"
})

export class AppSidenavMenuComponent implements OnDestroy {
  orderscount = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0
  };
  truckscount = {
    1: 0,
    2: 0,
    3: 0,
    4: 0
  };
  comopnentDestroyed: ReplaySubject<boolean> = new ReplaySubject<boolean>();
  alldepots: Array<Depot>;
  activedepot: Depot = Object.assign({}, emptydepot);

  constructor(private orderservice: OrdersService,
              private depotservice: DepotsService,
              private truckservice: TrucksService) {
    orderStagesarray.forEach(stage => {
      this.orderservice.orders[stage].pipe(takeUntil(this.comopnentDestroyed)).subscribe(orders => this.orderscount[stage] = orders.length);
    });
    truckStagesarray.forEach(stage => {
      this.truckservice.trucks[stage].pipe(takeUntil(this.comopnentDestroyed)).subscribe(trucks => this.truckscount[stage] = trucks.length);
    });
    this.depotservice.alldepots.pipe(takeUntil(this.comopnentDestroyed)).subscribe((alldepots: Array<Depot>) => {
      this.alldepots = alldepots;
    });
    this.depotservice.activedepot.pipe(takeUntil(this.comopnentDestroyed)).subscribe((depot: Depot) => {
      this.activedepot = depot;
    });
  }

  ngOnDestroy(): void {
    this.comopnentDestroyed.next(true);
    this.comopnentDestroyed.complete();
  }
  changeactivedepot(depot: Depot) {
    this.depotservice.changeactivedepot(depot);

  }

}
