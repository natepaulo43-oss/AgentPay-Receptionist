export declare function businessProfile(): {
    businessId: string;
    name: string;
    industry: string;
    serviceArea: string;
    hours: string;
    services: {
        name: string;
        category: string;
        typicalPriceRange: string;
        requiredQualifiers: string[];
    }[];
    agentInstructions: string[];
    demoScenario: {
        customerGoal: string;
        recommendedAction: string;
        appointmentTime: string;
        expectedPayment: {
            amount: string;
            currency: string;
            network: string;
            protocol: string;
        };
    };
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
        inputSchema: {
            type: string;
            required: string[];
            properties: {
                customerName: {
                    type: string;
                };
                customerPhone: {
                    type: string;
                };
                vehicle: {
                    type: string;
                };
                service: {
                    type: string;
                };
                appointmentTime: {
                    type: string;
                    format: string;
                };
                transcriptSnippet: {
                    type: string;
                };
            };
        };
        successSchema: {
            type: string;
            required: string[];
        };
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
        inputSchema?: undefined;
        successSchema?: undefined;
    })[];
    payment: {
        scheme: string;
        protocol: string;
        defaultNetwork: string;
        defaultNetworkName: string;
        payTo: string;
        facilitator: string;
        productionFacilitator: string;
        protectedRoutePattern: string;
        protectedDemoRoute: string;
    };
};
//# sourceMappingURL=businessProfile.d.ts.map