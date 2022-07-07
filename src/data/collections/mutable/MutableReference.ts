import { MutableContentEvents, MutableObject } from '../../model/mutable/MutableObject';
import { MutationOp } from '../../model/mutable/MutationOp';
import { HashedObject } from '../../model/immutable/HashedObject';
import { Timestamps } from 'util/timestamps';
import { Types } from '../Types';
import { Hash } from 'data/model/hashing/Hashing';
import { ClassRegistry } from 'data/model';
import { MultiMap } from 'util/multimap';
import { Identity } from 'data/identity';

class MutableReference<T> extends MutableObject {

    static className = 'hhs/v0/MutableReference';

    writer?: Identity;
    typeConstraints?: Array<string>;

    _sequence?: number;
    _timestamp?: string;
    _value?: T;

    constructor(config = {writer: undefined as (undefined | Identity)}) {
        super([RefUpdateOp.className]);

        this.writer = config.writer;
        this.setRandomId();
    }

    setWriter(writer?: Identity) {
        this.writer = writer;
    }

    getWriter() {
        return this.writer;
    }

    hasWriter() {
        return this.writer !== undefined;
    }

    getValue() : T | undefined {
        return this._value;
    }

    setValue(value: T) {

        if (!(value instanceof HashedObject)) {
            if (!HashedObject.isLiteral(value)) {
                throw new Error('MutableReferences can contain either a class deriving from HashedObject or a pure literal (a constant, without any HashedObjects within).');
            }
        }

        let op = new RefUpdateOp<T>(this, value, this._sequence);
        return this.applyNewOp(op);
    }

    mutate(op: MutationOp): Promise<boolean> {
        let refUpdateOp = op as RefUpdateOp<T>;

        let mutated = false;
        if (refUpdateOp.getTargetObject().equals(this)) {
            if (this._sequence === undefined || 
                this._sequence < refUpdateOp.getSequence() ||
                (this._sequence === refUpdateOp.getSequence() && 
                 Timestamps.after(refUpdateOp.getTimestamp(), this._timestamp as string))) {


                 const oldVal = this._value;

                 this._sequence = refUpdateOp.getSequence();
                 this._timestamp = refUpdateOp.getTimestamp();
                 this._value = refUpdateOp.getValue();                    

                 mutated = true;

                 this._mutationEventSource?.emit({emitter: this, action: 'update', data: refUpdateOp.getValue()});

                if (oldVal !== this._value) {
                    if (oldVal instanceof HashedObject) {
                        this._mutationEventSource?.emit({emitter: this, action: MutableContentEvents.RemoveObject, data: oldVal});
                    }
                    if (this._value instanceof HashedObject) {
                        this._mutationEventSource?.emit({emitter: this, action: MutableContentEvents.AddObject, data: this._value});
                    }
                }
            }
        }

        return Promise.resolve(mutated);
    }

    getMutableContents(): MultiMap<Hash, HashedObject> {
        const contents = new MultiMap<Hash, HashedObject>();

        if (this._value instanceof HashedObject) {
            contents.add(this._value.hash(), this._value);
        }

        return contents;
    }
    
    getMutableContentByHash(hash: Hash): Set<HashedObject> {
        
        const found = new Set<HashedObject>();
        
        if (this._value instanceof HashedObject && this._value.hash() === hash) {
            found.add(this._value);
        }

        return found;
    }

    getClassName(): string {
        return MutableReference.className;
    }
    
    init(): void {
        
    }

    async validate(references: Map<Hash, HashedObject>) {
        references;

        return Types.isTypeConstraint(this.typeConstraints) && (this.writer === undefined || this.writer instanceof Identity);
    }
}

class RefUpdateOp<T> extends MutationOp {

    static className = 'hhs/v0/RefUpdateOp';

    sequence?: number;
    timestamp?: string;
    value?: T;


    constructor(targetObject?: MutableReference<T>, value?: T, sequence?: number) {
        super(targetObject);

        if (targetObject !== undefined) {
            this.value = value;
            this.sequence = sequence === undefined? 0 : sequence + 1;
            this.timestamp = Timestamps.uniqueTimestamp();
            
            if (targetObject.writer !== undefined) {
                this.setAuthor(targetObject.writer);
            }
        }
        
    }

    getClassName(): string {
        return RefUpdateOp.className;
    }

    init(): void {

    }

    async validate(references: Map<Hash, HashedObject>) {

        if (!await super.validate(references)) {
            return false;
        }

        const targetObject = this.getTargetObject();

        if (!(targetObject instanceof MutableReference)) {
            return false;
        }

        if (targetObject.writer !== undefined && !(targetObject.writer.equals(this.getAuthor()))) {
            MutableObject.validationLog.debug('RefUpdateOp has author ' + this.getAuthor()?.hash() + ' but points to a target whose writer is ' + targetObject.writer.hash() + '.');
            return false;
        }

        if (this.sequence === undefined) {
            MutableObject.validationLog.debug('The field sequence is mandatory in class RefUpdateOp');
            return false;
        }

        if ((typeof this.sequence) !== 'number') {
            MutableObject.validationLog.debug('The field sequence should be of type number in class RefUpdateop');
            return false;
        }

        if (this.timestamp === undefined) {
            MutableObject.validationLog.debug('The field timestamp is mandatory in class RefUpdateOp');
            return false;
        }

        if ((typeof this.timestamp) !== 'string') {
            MutableObject.validationLog.debug('The field timestamp should be of type timestamp in class RefUpdateop');
            return false;
        }

        if (this.value === undefined) {
            MutableObject.validationLog.debug('The field value is mandatory in class REfUpdateop');
            return false;
        }

        let constraints = (this.targetObject as MutableReference<T>).typeConstraints;

        if (!Types.satisfies(this.value, constraints)) {
            MutableObject.validationLog.debug('RefUpdateOp contains a value with an unexpected type.');
            return false;
        }

        return true;
    }

    getSequence() {
        return this.sequence as number;
    }

    getTimestamp() {
        return this.timestamp as string;
    }

    getValue() {
        return this.value as T;
    }
}

ClassRegistry.register(MutableReference.className, MutableReference);
ClassRegistry.register(RefUpdateOp.className, RefUpdateOp);

export { MutableReference, RefUpdateOp };