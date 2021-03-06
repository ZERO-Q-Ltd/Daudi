import { MyGeoPoint } from "../../firestore/firestoreTypes";
import { deepCopy } from "../../utils/deepCopy";
import { emptymetadata, Metadata } from "../universal/Metadata";
import { ContactPerson } from "./ContactPerson";

export interface OMC {
  license: string;
  location: MyGeoPoint;
  name: string;
  userid: string;
  Id: string;
  description: string;
  status: boolean;
  contactperson: ContactPerson[];
  logourl: string;
  metadata: Metadata;
}

export const emptyomc: OMC = {
  license: null,
  contactperson: [
    {
      name: null,
      phone: null,
      email: null,
      position: null,
      address: null
    }
  ],
  logourl: null,
  status: null,

  /**
   * make default location Somewhere in nbi
   */
  location: new MyGeoPoint(-1.3373943, 36.7208522),
  name: null,
  Id: null,
  userid: null,
  description: null,
  metadata: deepCopy<Metadata>(emptymetadata)
};
