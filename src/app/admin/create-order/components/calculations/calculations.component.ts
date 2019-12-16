import { Component, OnInit, Input, Output, EventEmitter } from "@angular/core";
import { Order } from "./../../../../models/Daudi/order/Order";
import { OrderContactForm } from "./../../../../models/Daudi/forms/CreateOrder";
import { FuelType, FuelNamesArray } from "./../../../../models/Daudi/fuel/FuelType";
import { OrderFuelConfig } from "./../../../../models/Daudi/order/FuelConfig";
import { ConfigService } from "./../../../../admin/services/core/config.service";
import { Config, emptyConfig } from "./../../../../models/Daudi/omc/Config";
import { Environment } from "./../../../../models/Daudi/omc/Environments";
import { FormArray, FormControl, Controls, FormGroup, FormBuilder } from "ngx-strongly-typed-forms";
import { Validators } from "@angular/forms";
import { Calculations, FuelCalculation } from "./../../../../models/Daudi/forms/Calculations";
import { takeUntil, skipWhile } from "rxjs/operators";
import { ReplaySubject } from "rxjs";
import { DepotService } from "./../../../services/core/depot.service";
import { Depot, emptydepot } from "./../../../../models/Daudi/depot/Depot";
import { DepotConfig, emptyDepotConfig } from "./../../../../models/Daudi/depot/DepotConfig";

@Component({
  selector: "app-calculations",
  templateUrl: "./calculations.component.html",
  styleUrls: ["./calculations.component.scss"]
})
export class CalculationsComponent implements OnInit {
  @Input() initData: Order;
  @Input() newOrder: boolean;

  @Output() initDataChange = new EventEmitter();
  @Output() formValid = new EventEmitter<boolean>();

  fueltypesArray = FuelNamesArray;
  omcConfig: Config = { ...emptyConfig };
  activedepot: { depot: Depot, config: DepotConfig } = { depot: { ...emptydepot }, config: { ...emptyDepotConfig } };

  env: Environment = Environment.sandbox;
  calculationsform: FormGroup<Calculations> = new FormGroup<Calculations>({
    pms: new FormGroup<FuelCalculation>({
      price: new FormControl<number>(0, [Validators.required]),
      qty: new FormControl<number>(0, [Validators.required, Validators.min(1000)]),
    }),
    ago: new FormGroup<FuelCalculation>({
      price: new FormControl<number>(0, [Validators.required]),
      qty: new FormControl<number>(0, [Validators.required, Validators.min(1000)]),
    }),
    ik: new FormGroup<FuelCalculation>({
      price: new FormControl<number>(0, [Validators.required]),
      qty: new FormControl<number>(0, [Validators.required, Validators.min(1000)]),
    })
  });

  comopnentDestroyed: ReplaySubject<boolean> = new ReplaySubject<boolean>();


  constructor(
    private configService: ConfigService,
    private depot: DepotService
  ) {
    this.configService.environment.pipe(
      takeUntil(this.comopnentDestroyed)
    ).subscribe(val => {
      this.env = val;
    });
    this.depot.activedepot.pipe(
      takeUntil(this.comopnentDestroyed),
      skipWhile(t => !t.depot.Id))
      .subscribe(dep => {
        this.activedepot = dep;

      });
    this.calculationsform.valueChanges
      .pipe(takeUntil(this.comopnentDestroyed))
      .subscribe((value) => {
        /**
         * Only do calculation if the quantities are above threshold
         */
        if (value.pms.qty >= 1000 || value.ago.qty >= 1000 || value.ik.qty >= 1000) {
          this.fueltypesArray.forEach(fueltype => {
            this.calculationsform.get([fueltype, "qty"]).setErrors(null);
            this.initData.fuel[fueltype].qty = value[fueltype].qty;
            this.initData.fuel[fueltype].priceconfig.price = value[fueltype].price;

            const decimamlResolution = value[`${fueltype}qtyControl`] >= 10000 ? 4 : 3;
            const calculatedpirces = this.deriveprice(this.initData.fuel[fueltype].priceconfig.price, fueltype, decimamlResolution);
            this.initData.fuel[fueltype].priceconfig.taxablePrice = calculatedpirces.taxablePrice;
            this.initData.fuel[fueltype].priceconfig.nonTaxprice = calculatedpirces.pricewithoutvat;

            const totalwithouttax = this.totalswithouttax(this.initData.fuel[fueltype].priceconfig.nonTaxprice, this.initData.fuel[fueltype].qty);
            this.initData.fuel[fueltype].priceconfig.nonTaxtotal = totalwithouttax;

            // this.initData.fuel[fueltype].priceconfig.total = taxcalculations.taxamount + totalwithouttax;
            this.initData.fuel[fueltype].priceconfig.total = this.initData.fuel[fueltype].priceconfig.price * this.initData.fuel[fueltype].qty;

            this.initData.fuel[fueltype].priceconfig.taxAmnt = this.initData.fuel[fueltype].priceconfig.total - totalwithouttax;
            this.initData.fuel[fueltype].priceconfig.taxableAmnt = totalwithouttax;

            this.initData.fuel[fueltype].priceconfig.difference = this.calculateupmark(
              this.initData.fuel[fueltype].priceconfig.price,
              this.initData.fuel[fueltype].priceconfig.retailprice,
              this.initData.fuel[fueltype].qty);

          });
        }
      });
  }
  ngOnChanges(changes: any) {
    if (changes.initData) {
      console.log(changes.initData.currentValue);
      this.fueltypesArray.forEach(fueltype => {
        /**
         * set the order price values on depot config change
         */
        this.initData.fuel[fueltype].priceconfig.retailprice = this.activedepot.config.price[fueltype].price;
        this.initData.fuel[fueltype].priceconfig.minsp = this.activedepot.config.price[fueltype].minPrice;
        this.initData.fuel[fueltype].priceconfig.nonTax = this.omcConfig.taxExempt[this.env][fueltype].amount;
        /**
         * set the form price values on depot config change
         */
        this.calculationsform.updateValueAndValidity();
      });
    }
  }

  ngOnInit() {


  }

  determinediscount() {
    if ((this.initData.fuel.pms.priceconfig.difference + this.initData.fuel.ago.priceconfig.difference
      + this.initData.fuel.ik.priceconfig.difference) > 0) {
      return "Upmark " + Number(this.initData.fuel.pms.priceconfig.difference +
        this.initData.fuel.ago.priceconfig.difference + this.initData.fuel.ik.priceconfig.difference);
    } else {
      return "Discount " + Math.abs(Number(this.initData.fuel.pms.priceconfig.difference +
        this.initData.fuel.ago.priceconfig.difference + this.initData.fuel.ik.priceconfig.difference));
    }
  }

  initordersform() {
    // if (!this.discApproval) {
    //   this.temporder.notifications = {
    //     /**
    //      * Initialise these variables default as false for sandbox environment
    //      */
    //     sms: this.configService.environment.value === "sandbox" ? false : true,
    //     email: this.configService.environment.value === "sandbox" ? false : true
    //   };
    //   /**
    //    * @todo finish min price calculation logic
    //    */
    //   this.fueltypesArray.forEach((fueltype: FuelType) => {
    //     /**
    //      * Make sure that the current selling price is lower than the min selling price for the most recent entry
    //      */
    //     if (this.activedepot.config.price[fueltype].price >= this.activedepot.config.price[fueltype].minPrice) {
    //       this.tempsellingprices[fueltype] = this.activedepot.config.price[fueltype].minPrice;
    //     } else {
    //       this.tempsellingprices[fueltype] = this.activedepot.config.price[fueltype].price;
    //       this.notificationService.notify({
    //         alert_type: "notify",
    //         duration: 20000,
    //         title: "Invalid Prices",
    //         body: `The current selling price for ${fueltype} is lower than the Min selling price, hence the Min selling price has been used`
    //       });
    //     }
    //     this.orderform.controls[fueltype].setValue(this.temporder.fuel[fueltype].priceconfig.price = this.tempsellingprices[fueltype]);
    //     this.orderform.controls[fueltype].setValidators(Validators.compose([Validators.min(this.activedepot.config.price[fueltype].minPrice), Validators.required]));
    //   });
    // } else {
    //   this.fueltypesArray.forEach((fueltype) => {
    //     this.orderform.controls[fueltype].setValue(this.temporder.fuel[fueltype].priceconfig.price = this.tempsellingprices[fueltype]);
    //     this.orderform.controls[fueltype].setValidators(Validators.compose([Validators.min(this.activedepot.config.price[fueltype].price), Validators.required]));
    //   });
    // }
  }
  /**
   * uses the simple formula :
   * PricewithoutVAT=OriginalPrice + (0.08*VATExempt)/1.08, simplified
   * Decimal resolution depends on the qty, as above 10000l the point affects significant amount, but at the same time we
   * Dont want decimals at lower quantities
   */
  deriveprice(priceinclusivevat: number, fueltype: FuelType, decimalResolution: number): { pricewithoutvat: number, amountdeducted: number, taxablePrice: number } {
    const pricewithoutvat = Number(((priceinclusivevat + (0.08 * this.initData.fuel[fueltype].priceconfig.nonTax)) / 1.08).toFixed(decimalResolution));
    const amountdeducted = priceinclusivevat - pricewithoutvat;
    const taxablePrice = Number((pricewithoutvat - this.initData.fuel[fueltype].priceconfig.nonTax).toFixed(decimalResolution));
    return { pricewithoutvat, amountdeducted, taxablePrice };
  }
  ngOnDestroy(): void {
    this.comopnentDestroyed.next(true);
  }

  /**
   * calculates the total amount exclusive of tax
   * @param nontaxprice price exclusive of tax. refer to deriveprice()
   * @param quantity fuel quantity
   */
  totalswithouttax(nontaxprice: number, quantity: number): number {
    // console.log(nontaxprice, quantity);
    return Math.round(nontaxprice * quantity);
  }

  calculateupmark(orderprice: number, retailprice: number, quanity: number): number {
    return Math.round((orderprice - retailprice) * quanity);
  }

}
