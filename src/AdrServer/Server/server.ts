import "reflect-metadata";

import express from "express";
import { injectable, inject } from "tsyringe";
import winston from "winston";
import { RevokeMiddleware } from "./Handlers/Revoke";
import { ClientBearerJwtVerificationMiddleware } from "../../Common/Server/Middleware/CdsClientBearerJwtVerification";
import uuid from "uuid"
import http from "http"
import { DefaultConnector } from "../../Common/Connectivity/Connector.generated";

const requestCorrelationMiddleware = (req,res:http.ServerResponse,next) => {
    req.correlationId = uuid.v4()
    res.setHeader("adr-server-correlation-id",req.correlationId)
    next()
}

@injectable()
export class AdrServer {
    constructor(
        @inject("Logger") private logger:winston.Logger,
        private revocationMiddleware: RevokeMiddleware,
        private connector: DefaultConnector,
        private clientBearerJwtVerificationMiddleware: ClientBearerJwtVerificationMiddleware
    ) {}

    init(): ReturnType<typeof express> {
        const app = express();       
       
        app.use(requestCorrelationMiddleware)

        app.get( "/jwks", async ( req, res ) => {
            // output the public portion of the key
          
            res.setHeader("content-type","application/json");
            let result = (await this.connector.DataRecipientJwks().GetWithHealing()).toJWKS(false)
            res.send(result);
            this.logger.info("Someone requested JWKS")
            
        } );
               
        app.post( "/revoke",
            this.clientBearerJwtVerificationMiddleware.handler((assumedClientId:string) => {
                return this.connector.DataHolderRevocationJwks(assumedClientId)
            }),
            this.revocationMiddleware.handler()
        );
        
        return app;
       
    }
}
