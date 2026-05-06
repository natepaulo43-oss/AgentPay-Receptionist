export declare function businessProfile(): {
    businessId: string;
    name: string;
    industry: string;
    serviceArea: string;
    hours: string;
    services: string[];
    freeCapabilities: {
        action: string;
        endpoint: string;
        method: string;
        description: string;
    }[];
    paidCapabilities: ({
        action: string;
        endpoint: string;
        method: string;
        price: string;
        currency: string;
        network: string;
        networkName: string;
        protocol: string;
        description: string;
    } | {
        action: string;
        endpoint: string;
        method: string;
        price: string;
        currency: string;
        network: string;
        networkName: string;
        protocol: string;
        description?: undefined;
    })[];
    payment: {
        scheme: string;
        protocol: string;
        defaultNetwork: string;
        defaultNetworkName: string;
        payTo: string;
        facilitator: string;
        productionFacilitator: string;
    };
};
//# sourceMappingURL=businessProfile.d.ts.map