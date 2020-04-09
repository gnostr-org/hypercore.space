import { MutableObject, MutationOp, Hash } from 'data/model';

class SomethingMutable extends MutableObject {

    static className = 'hhs-test/SomethingMutable';

    _operations: Map<Hash, MutationOp>;

    constructor() {
        super([SomeMutation.className]);

        this.setRandomId();

        this._operations = new Map();
    }

    getClassName() {
        return SomethingMutable.className;
    }

    async mutate(_op: MutationOp): Promise<boolean> {
        this._operations.set(_op.hash(), _op);

        return true;
    }

    getOperations() : Set<MutationOp>{
        return new Set(this._operations.values());
    }

    async testOperation(payload: string) {
        let op = new SomeMutation(this);
        op.payload = payload;
        await this.applyNewOp(op);
    }

}

SomethingMutable.registerClass(SomethingMutable.className, SomethingMutable);

class SomeMutation extends MutationOp {
    static className = 'hhs-test/SomeMutation';

    payload?: string;

    constructor(target?: MutableObject) {
        super(target);
    }

    getClassName() {
        return SomeMutation.className;
    }
}

SomeMutation.registerClass(SomeMutation.className, SomeMutation);

export { SomethingMutable }