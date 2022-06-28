import { singleton, injectable } from "tsyringe";
import fs from "fs"
import { AxiosRequestConfig } from "axios";
import https from "https"
import _ from "lodash"
import { CertsFromFilesOrStrings } from "../../Common/SecurityProfile/Util";

const mtlsByProduct = JSON.parse(process.env.MTLS_BY_PRODUCT || "{}")


interface ClientCertificateInjector {
    inject(options: AxiosRequestConfig & {softwareProductId?:string}):AxiosRequestConfig
    injectCa(options: AxiosRequestConfig):AxiosRequestConfig
}

class DevClientCertificateInjector implements ClientCertificateInjector{
    inject = (options: AxiosRequestConfig):AxiosRequestConfig => {
        if (typeof options.headers == 'undefined') options.headers = {}
        options.headers["x-cdrgw-cert-thumbprint"] = "adr-THUMBPRINT"
        return options;
    }
    injectCa = (options: AxiosRequestConfig):AxiosRequestConfig => options
}

export const MTLSInject = (request:AxiosRequestConfig,options:{key?:string|string[], cert?:string|string[],ca?: string|string[], passphrase?:string}) => {
    let inj = new DefaultClientCertificateInjector(options);
    return inj.inject(request)
}

export const TLSInject = (request:AxiosRequestConfig,options:{key?:string|string[], cert?:string|string[],ca?: string|string[], passphrase?:string}) => {
    let inj = new DefaultClientCertificateInjector(options);
    return inj.injectCa(request)
}


@injectable()
class DefaultClientCertificateInjector implements ClientCertificateInjector{
    key:Buffer|Buffer[];
    cert:Buffer|Buffer[];
    ca:Buffer|Buffer[];
    passphrase:string|undefined;
    
    constructor(options:{key?:string|string[], cert?:string|string[],ca?: string|string[], passphrase?:string}) {
        this.key = CertsFromFilesOrStrings(options?.key);
        this.cert = CertsFromFilesOrStrings(options?.cert);
        this.ca = CertsFromFilesOrStrings(options?.ca);
        this.passphrase = options?.passphrase;
    }

    inject = (options: AxiosRequestConfig & {softwareProductId?:string}):AxiosRequestConfig => {


        if (options.softwareProductId) {
            options.httpsAgent = new https.Agent({
                cert: mtlsByProduct[options.softwareProductId]?.cert ? CertsFromFilesOrStrings(mtlsByProduct[options.softwareProductId].cert): this.cert,
                key: mtlsByProduct[options.softwareProductId]?.key ? CertsFromFilesOrStrings(mtlsByProduct[options.softwareProductId].key): this.key,
                ca: mtlsByProduct[options.softwareProductId]?.ca ? CertsFromFilesOrStrings(mtlsByProduct[options.softwareProductId].ca): this.ca,
                passphrase: mtlsByProduct[options.softwareProductId]?.passphrase || this.passphrase,
            })        
    
            return _.omit(options,"softwareProductId");   
            
        } else {
            options.httpsAgent = new https.Agent({
                cert: this.cert,
                key: this.key,
                ca: this.ca,
                passphrase: this.passphrase,
            })        
    
            return options;   
        }

    }

    injectCa = (options: AxiosRequestConfig):AxiosRequestConfig => {
        options.httpsAgent = new https.Agent({
            ca: this.ca
        })        
        return options;
    }

}


export {ClientCertificateInjector, DevClientCertificateInjector, DefaultClientCertificateInjector}