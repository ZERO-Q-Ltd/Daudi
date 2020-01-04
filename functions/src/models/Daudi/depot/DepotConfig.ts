import { FuelType } from "../fuel/FuelType";
import { DepotPrice } from "./DepotPrice";
import { inituser, AssociatedUser } from "../admin/AssociatedUser";
import { deepCopy } from "../../utils/deepCopy";
import { DepotStock, EmptyDepotQty } from "./DepotStock";
import { Environment } from "../omc/Environments";
export interface DepotConfig {
    /**
     * The same depot can have 2 different configs due to live and sandbox environments
     */
    Id: string;
    depotId: string;
    environment: Environment;
    QbId: string;
    CompanyRep: {
        phone: null;
        name: null;
    };
    price: {
        [key in FuelType]: DepotPrice;
    };
    hospitality: {
        amnt: number;
    };
    stock: {
        [key in FuelType]: DepotStock;
    };
}
const initPrice: DepotPrice = {
    price: 0,
    minPrice: 0,
    user: deepCopy<AssociatedUser>(inituser)
};
export const emptyDepotConfig: DepotConfig = {
    depotId: null,
    Id: null,
    environment: Environment.sandbox,
    QbId: null,
    CompanyRep: {
        name: null,
        phone: null
    },
    stock: {
        ago: deepCopy<DepotStock>(EmptyDepotQty),
        pms: deepCopy<DepotStock>(EmptyDepotQty),
        ik: deepCopy<DepotStock>(EmptyDepotQty)
    },
    hospitality: {
        amnt: 0
    },
    price: {
        ago: deepCopy<DepotPrice>(initPrice),
        pms: deepCopy<DepotPrice>(initPrice),
        ik: deepCopy<DepotPrice>(initPrice)
    }
};
