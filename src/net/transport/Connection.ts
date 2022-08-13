import { LinkupAddress } from "net/linkup/LinkupAddress";

interface Connection {

    readonly localAddress: LinkupAddress;
    readonly remoteAddress: LinkupAddress;
    readonly remoteInstanceId?: string;

    getConnectionId() : string;
    initiatedLocally(): boolean;

    

    setMessageCallback(messageCallback: (message: any, conn: Connection) => void): void;

    channelIsOperational(): boolean;

    close(): void;

    send(message: any) : void;

    bufferedAmount(): number;
}

export { Connection };