import { Metadata } from "../universal/Metadata";
import { emptymetadata } from "../universal/universal";
export interface FuelConfig {
    allocation: {
        qty: number;
    };
    QbId: number;
    tax: {
        QbId: number;
        nonTax: number;
        metadata: Metadata;
    };
}

export const emptyFuelConfig: FuelConfig = {
    allocation: {
        qty: 0
    },
    QbId: null,
    tax: {
        QbId: null,
        metadata: { ...emptymetadata },
        nonTax: 0
    },
};