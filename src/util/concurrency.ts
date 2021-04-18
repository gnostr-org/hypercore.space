

class Lock {

    inUse: boolean;

    constructor() {
        this.inUse = false;
    }

    acquire(): boolean {
        const success = !this.inUse;
        this.inUse = true;
        return success;
    }

    release(): boolean {
        return false;
    }

}

export { Lock };