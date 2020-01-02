import { Injectable } from "@angular/core";
import { AngularFirestore } from "@angular/fire/firestore";
import { Depot } from "../../models/Daudi/depot/Depot";
import { DepotService } from "./core/depot.service";
import { ConfigService } from "./core/config.service";
import { OmcService } from "./core/omc.service";

@Injectable({
  providedIn: "root"
})
export class StatsService {
  activedepot: Depot;

  constructor(
    private config: ConfigService,
    private omc: OmcService,
    private db: AngularFirestore,
    private core: DepotService) {

  }


  getstats(statsid: string, omcid: string) {
    return this.db.firestore.collection("omc")
      .doc(omcid)
      .collection("stats")
      .doc(statsid);
  }

  getstatsrange(omcid: string, start, stop) {
    return this.db.firestore.collection("omc")
      .doc(omcid)
      .collection("stats")
      .where("date", ">=", start)
      .where("date", "<=", stop);
  }

}
