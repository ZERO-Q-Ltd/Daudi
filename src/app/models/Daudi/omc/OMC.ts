import { Metadata, emptymetadata } from "../universal/Metadata";
import { ContactPerson } from "./ContactPerson";
import { firestore } from "firebase";
import { deepCopy } from "../../utils/deepCopy";
export interface OMC {
    license: string;
    location: firestore.GeoPoint;
    name: string;
    userid: string;
    Id: string;
    description: string;
    status: boolean;
    contactperson: Array<ContactPerson>;
    logourl: string;
    metadata: Metadata;
}



export const emptyomc: OMC = {
    license: null,
    contactperson: [],
    logourl: null,
    status: null,


    /**
     * make default location Somewhere in nbi
     */
    location: new firestore.GeoPoint(-1.3373943, 36.7208522),
    name: null,
    Id: null,
    userid: null,
    description: null,
    metadata: deepCopy<Metadata>(emptymetadata),

};

