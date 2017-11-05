/*
 * W3C Software License
 *
 * Copyright (c) 2017 the thingweb community
 *
 * THIS WORK IS PROVIDED "AS IS," AND COPYRIGHT HOLDERS MAKE NO REPRESENTATIONS OR
 * WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO, WARRANTIES OF
 * MERCHANTABILITY OR FITNESS FOR ANY PARTICULAR PURPOSE OR THAT THE USE OF THE
 * SOFTWARE OR DOCUMENT WILL NOT INFRINGE ANY THIRD PARTY PATENTS, COPYRIGHTS,
 * TRADEMARKS OR OTHER RIGHTS.
 *
 * COPYRIGHT HOLDERS WILL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, SPECIAL OR
 * CONSEQUENTIAL DAMAGES ARISING OUT OF ANY USE OF THE SOFTWARE OR DOCUMENT.
 *
 * The name and trademarks of copyright holders may NOT be used in advertising or
 * publicity pertaining to the work without specific, written prior permission. Title
 * to copyright in this work will at all times remain with copyright holders.
 */

/**
 * HTTP client based on http
 */
import { ProtocolClient, Content } from "node-wot";

import * as http from "http";
import * as https from "https";
import * as url from "url";

export default class HttpClient implements ProtocolClient {

  private readonly agent: http.Agent;
  private readonly provider : any;
  private proxyOptions : http.RequestOptions = null;

  constructor(proxy : any = null, secure = false) {
    if (proxy!==null && proxy.href!==null) {
      this.proxyOptions = this.uriToOptions(proxy.href);
      if (proxy.authorization == "Basic") {
        this.proxyOptions.headers = { };
        this.proxyOptions.headers['Proxy-Authorization'] = "Basic " + new Buffer(proxy.user+":"+proxy.password).toString('base64');
      }
      if (this.proxyOptions.protocol === "https") {
        secure = true;
      } else {
        secure = false;
      }
      console.info(`HttpClient using ${secure ? "secure " : ""}proxy ${this.proxyOptions.hostname}:${this.proxyOptions.port}`);
    }
    this.agent = secure ? new https.Agent({ keepAlive: true }) : new http.Agent({ keepAlive: true });
    this.provider = secure ? https : http;
  }

  private getContentType(res : http.IncomingMessage) : string {
    let header : string | string[] = res.headers['content-type']; // note: node http uses lower case here
    if(Array.isArray(header)) {
      // this should never be the case as only cookie headers are returned as array
      // but anyways...
      return (header.length > 0) ? header[0] : ""; 
    } else {
      return header;
    }
  }

  public toString(): string {
    return `[HttpClient]`;
  }

  public readResource(uri: string): Promise<Content> {
    return new Promise<Content>((resolve, reject) => {
      let options: http.RequestOptions = this.uriToOptions(uri);

      // TODO get explicit binding from TD
      options.method = 'GET';
      console.log(`HttpClient sending ${options.method} ${options.path} to ${options.hostname}:${options.port}`);
      let req = this.provider.request(options, (res : https.IncomingMessage) => {
        console.log(`HttpClient received ${res.statusCode} from ${options.path}`);
        let mediaType: string = this.getContentType(res);
        //console.log(`HttpClient received Content-Type: ${mediaType}`);
        //console.log(`HttpClient received headers: ${JSON.stringify(res.headers)}`);
        let body: Array<any> = [];
        res.on('data', (data) => { body.push(data) });
        res.on('end', () => {
          resolve({ mediaType: mediaType, body: Buffer.concat(body) });
        });
      });
      req.on('error', (err : any) => reject(err));
      req.end();
    });
  }

  public writeResource(uri: string, content: Content): Promise<any> {
    return new Promise<void>((resolve, reject) => {

      let options: http.RequestOptions = this.uriToOptions(uri);

      // TODO get explicit binding from TD
      options.method = 'PUT';
      options.headers = { 'Content-Type': content.mediaType, 'Content-Length': content.body.byteLength };

      console.log(`HttpClient sending ${options.method} ${options.path} to ${options.hostname}:${options.port}`);
      let req = this.provider.request(options, (res : https.IncomingMessage) => {
        console.log(`HttpClient received ${res.statusCode} from ${uri}`);
        //console.log(`HttpClient received headers: ${JSON.stringify(res.headers)}`);
        // Although 204 without payload is expected, data must be read 
        // to complete request (http blocks socket otherwise)
        // TODO might have response on write for future HATEOAS concept
        let body: Array<any> = [];
        res.on('data', (data) => { body.push(data) });
        res.on('end', () => {
          resolve();
        });
      });
      req.on('error', (err : any) => reject(err));
      req.write(content.body);
      req.end();
    });
  }

  public invokeResource(uri: string, content?: Content): Promise<Content> {
    return new Promise<Content>((resolve, reject) => {

      let options: http.RequestOptions = this.uriToOptions(uri);

      // TODO get explicit binding from TD
      options.method = 'POST';
      if (content) {
        options.headers = { 'Content-Type': content.mediaType, 'Content-Length': content.body.byteLength };
      }
      console.log(`HttpClient sending ${options.method} ${options.path} to ${options.hostname}:${options.port}`);
      let req = this.provider.request(options, (res : https.IncomingMessage) => {
        console.log(`HttpClient received ${res.statusCode} from ${uri}`);
        let mediaType: string = this.getContentType(res);        
        //console.log(`HttpClient received Content-Type: ${mediaType}`);
        //console.log(`HttpClient received headers: ${JSON.stringify(res.headers)}`);
        let body: Array<any> = [];
        res.on('data', (data) => { body.push(data) });
        res.on('end', () => {
          resolve({ mediaType: mediaType, body: Buffer.concat(body) });
        });
      });
      req.on('error', (err : any) => reject(err));
      if (content) {
        req.write(content.body);
      }
      req.end();
    });
  }

  public unlinkResource(uri: string): Promise<any> {
    return new Promise<void>((resolve, reject) => {
      let options: http.RequestOptions = this.uriToOptions(uri);

      // TODO get explicit binding from TD
      options.method = 'DELETE';

      console.log(`HttpClient sending ${options.method} ${options.path} to ${options.hostname}:${options.port}`);
      let req = this.provider.request(options, (res : https.IncomingMessage) => {
        console.log(`HttpClient received ${res.statusCode} from ${uri}`);
        //console.log(`HttpClient received headers: ${JSON.stringify(res.headers)}`);
        // Although 204 without payload is expected, data must be read
        //  to complete request (http blocks socket otherwise)
        // TODO might have response on unlink for future HATEOAS concept
        let body: Array<any> = [];
        res.on('data', (data) => { body.push(data) });
        res.on('end', () => {
          resolve();
        });
      });
      req.on('error', (err : any) => reject(err));
      req.end();
    });
  }

  public start(): boolean {
    return true;
  }

  public stop(): boolean {
    this.agent.destroy();
    return true;
  }

  public setSecurity(metadata: any): boolean {
    if (metadata.cat!==null && metadata.cat==="proxy" && metadata.href!==null) {
      this.proxyOptions = this.uriToOptions(metadata.href);
      if (metadata.authorization == "Basic") {
        this.proxyOptions.headers = { };
        this.proxyOptions.headers['Proxy-Authorization'] = "Basic " + new Buffer(metadata.user+":"+metadata.password).toString('base64');
      }
      console.info(`HttpClient using security metadata ${metadata.cat}`);
      return true;
    }
    return false;
  }

  private uriToOptions(uri: string): http.RequestOptions {
    let requestUri = url.parse(uri);
    let options: http.RequestOptions = {};
    options.agent = this.agent;

    if (this.proxyOptions!=null) {
      options.hostname = this.proxyOptions.hostname;
      options.port = this.proxyOptions.port;
      options.path = uri;
      options.headers = { };
      // copy header fields for Proxy-Auth etc.
      for (let hf in this.proxyOptions.headers) options.headers[hf] = this.proxyOptions.headers[hf];
      options.headers["Host"] = requestUri.hostname;
    } else {
      options.hostname = requestUri.hostname;
      options.port = parseInt(requestUri.port, 10);
      options.path = requestUri.path;
    }
    // TODO auth and headers

    return options;
  }

}
