import { MutableObject } from '../model/MutableObject';
import { HashedObject } from '../model/HashedObject';
import { Hash } from 'data/model/Hashing';
import { MutationOp } from 'data/model/MutationOp';
import { HashedSet } from 'data/model/HashedSet';
import { HashReference } from 'data/model/HashReference';
import { Types } from './Types';

type ElmtHash = Hash;

// a simple mutable set with a single writer

abstract class MutableSetOp<T extends HashedObject> extends MutationOp {

    constructor(target?: MutableSet<T>) {
        super(target);

        if (target !== undefined) {
            let author = target.getAuthor();
            if (author !== undefined) {
                this.setAuthor(author);
            }
        }
    }

    init(): void {

    }

    validate(references: Map<Hash, HashedObject>) {

        if (!super.validate(references)) {
            return false;
        }

        if (! (this.getTarget() instanceof MutableSet)) {
            return false;
            //throw new Error('MutableSetOp.target must be a MutableSet, got a ' + this.getTarget().getClassName() + ' instead.');
        }

        if (this.getTarget().getAuthor() !== undefined && !(this.getTarget().getAuthor()?.equals(this.getAuthor()))) {
            return false;
            //throw new Error('MutableSetOp has author ' + this.getAuthor()?.hash() + ' but points to a target authored by ' + this.getTarget().getAuthor()?.hash() + '.');
        }

        return true;
    }
    
}

class MutableSetAddOp<T extends HashedObject> extends MutableSetOp<T> {

    static className = 'hhs/MutableSetAddOp';

    element?: T;

    constructor(target?: MutableSet<T>, element?: T) {
        super(target);

        if (element !== undefined) {
            this.element = element;
            this.setRandomId();
        }   
    }

    getClassName() {
        return MutableSetAddOp.className;
    }

    init() {
        super.init();
    }

    validate(references: Map<Hash, HashedObject>) {

        if (!super.validate(references)) {
            return false;
        }

        const constraints = (this.getTarget() as MutableSet<T>).typeConstraints;

        if (!Types.satisfies(this.element, constraints)) {
            return false;
            //throw new Error('MutableSetAddOp contains a value with an unexpected type.')
        }

        return true;
    }
}

MutableSetAddOp.registerClass(MutableSetAddOp.className, MutableSetAddOp);

class MutableSetDeleteOp<T extends HashedObject> extends MutableSetOp<T> {

    static className = 'hhs/MutableSetDeleteOp';

    elementHash? : Hash;
    deletedOps?  : HashedSet<HashReference<MutableSetAddOp<T>>>;

    constructor(target?: MutableSet<T>, elementHash?: Hash, addOps?: IterableIterator<HashReference<MutableSetAddOp<T>>>) {
        super(target);

        this.elementHash = elementHash;

        if (addOps !== undefined) {
            this.deletedOps = new HashedSet();

            for (const addOp of addOps) {                
                if (addOp.className !== MutableSetAddOp.className) {
                    throw new Error('Trying to create a delete op referencing an op that is not an addition op.');
                }

                this.deletedOps.add(addOp);
            }
        }
    }

    // need a valid() function, that is called only when an object is NEW and we don't yet
    // trust its integrity. init() will be called every time it is loaded (after all the
    // fields have been filled in, either by the constructor or by the deliteralization
    // mechanism, and after valid, if it is untrusted)
    
    // valid needs all the references also, already validated, to do its checks.

    // (all this follows from the need to validate deletedOps)

    init() {

        super.init();

    }

    validate(references: Map<Hash, HashedObject>) {

        if (!super.validate(references)) {
            return false;
        }


        if (this.elementHash === undefined) {
            return false;
            //throw new Error('The field elementHash of type MutableSetDeletOp is mandatory.')
        }

        if (typeof this.elementHash !== 'string') {
            return false;
            //throw new Error('The field elementHash of type MutebleSetDeleteOp should be a string.')
        }

        if (this.deletedOps === undefined) {
            return false;
            //throw new Error('The field deletedOps of type MutableSetDeleteOp is mandatory');
        }

        if (!(this.deletedOps instanceof HashedSet)) {
            return false;
            //throw new Error('The field deletedOps of type MutableSetDeleteOp should be a HashedSet.');
        }


        return true;

    }

    getClassName() {
        return MutableSetDeleteOp.className;
    }

    
}

MutableSetDeleteOp.registerClass(MutableSetDeleteOp.className, MutableSetDeleteOp);

class MutableSet<T extends HashedObject> extends MutableObject {

    static className = 'hss/MutableSet';
    static opClasses = [MutableSetAddOp.className, MutableSetDeleteOp.className];

    typeConstraints?: Array<string>;

    _elements: Map<ElmtHash, T>;
    _currentAddOpRefs: Map<ElmtHash, HashedSet<HashReference<T>>>;

    constructor() {
        super(MutableSet.opClasses);

        this.setRandomId();

        this._elements = new Map();
        this._currentAddOpRefs = new Map();

    }

    init(): void {

    }

    validate(references: Map<Hash, HashedObject>) {
        references;
        return Types.isTypeConstraint(this.typeConstraints);
    }

    async add(element: T) {
        let op = new MutableSetAddOp(this, element);
        await this.applyNewOp(op);
    }

    async delete(element: T) {
        return await this.deleteByHash(element.hash());
    }

    async deleteByHash(hash: Hash): Promise<boolean> {
        let addOpRefs = this._currentAddOpRefs.get(hash);

        if (addOpRefs !== undefined  && addOpRefs.size() > 0) {
            let op = new MutableSetDeleteOp(this, hash, addOpRefs.values());
            await this.applyNewOp(op);
            return true;
        } else {
            return false;
        }
    }

    has(element: T) {
        return this.hasByHash(element.hash());
    }

    hasByHash(hash: Hash) {
        return this._elements.get(hash) !== undefined;
    }

    size() {
        return this._elements.size;
    }

    values() {
        return this._elements.values();
    }

    async mutate(op: MutationOp): Promise<void> {

        if (op instanceof MutableSetAddOp ) {
            const addOp = op as MutableSetAddOp<T>;

            let hash = op.element.hash();

            if (hash === undefined) {
                throw new Error('Trying to add an element to set, but the element is undefined.');
            }

            let current = this._currentAddOpRefs.get(hash);

            if (current === undefined) {
                current = new HashedSet();
                this._currentAddOpRefs.set(hash, current);
            }

            current.add(addOp.createReference());

            this._elements.set(hash, addOp.element as T)

        } else if (op instanceof MutableSetDeleteOp) {
            const deleteOp = op as MutableSetDeleteOp<T>;

            let hash = deleteOp.elementHash;

            if (hash === undefined) {
                throw new Error('Trying to remove an element from set, but elementHash is undefined.');
            }

            let current = this._currentAddOpRefs.get(hash);

            if (current !== undefined) {
                if (deleteOp.deletedOps !== undefined) {
                    for (const opRef of deleteOp.deletedOps.values()) {
                        current.remove(opRef);
                    }
                }

                if (current.size() === 0) {
                    this._elements.delete(hash);
                    this._currentAddOpRefs.delete(hash);
                }
            }

        } else {
            throw new Error("Method not implemented.");
        }

        
    }
    
    getClassName(): string {
        return MutableSet.className;
    }

}

MutableSet.registerClass(MutableSet.className, MutableSet);


export { MutableSet };