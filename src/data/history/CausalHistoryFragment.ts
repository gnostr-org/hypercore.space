import { MultiMap } from 'util/multimap';
import { Hash } from '../model/Hashing';
import { OpCausalHistory, OpCausalHistoryLiteral } from './OpCausalHistory';



// lemma: if an op is new to the fragment, then it either
//
//        a) is in the startingOps set.
//
//                     or
//
//        b) is not a direct dependency of any ops in the fragment
//           and therefore it should go into terminalOps.

// proof: assume neither a) or b) hold, then you have a
//        new op that is not in startingOps, but is a
//        direct dependency of an op present in the fragment.
//        But then, since it is a direct dependency and it is not in
//        startingOps, it must be present in the fragment, contrary
//        to our assumption.


class CausalHistoryFragment {

    target: Hash;

    terminalOps : Set<Hash>;
    startingOps  : Set<Hash>;

    contents: Map<Hash, OpCausalHistory>;
    
    nextOps : MultiMap<Hash, Hash>;

    constructor(target: Hash) {
        this.target = target;
        this.terminalOps = new Set();
        this.startingOps  = new Set();

        this.contents = new Map();

        this.nextOps = new MultiMap();
    }

    add(opHistory: OpCausalHistory) {

        if (this.isNew(opHistory.opHash)) {
            
            this.contents.set(opHistory.opHash, opHistory);

            // Adjust startingOps and terminalOps (see lemma above)
            if (this.startingOps.has(opHistory.opHash)) {
                this.startingOps.delete(opHistory.opHash);
            } else {
                this.terminalOps.add(opHistory.opHash);
            }
            
            for (const prevOpHash of opHistory.prevOpHashes) {

                // Adjust startingOps and terminalOps with info about this new prev op
                if (this.isNew(prevOpHash)) {
                    // It may or may not be in startingOps but, since prevOp 
                    // is new, in any case add:
                    this.startingOps.add(prevOpHash);
                } else {
                    // It may or may not be in terminalOps but, since prevOp 
                    // is not new, in any case remove:
                    this.terminalOps.delete(prevOpHash);

                }

                // Add reverse mapping to nextOps
                this.nextOps.add(prevOpHash, opHistory.opHash)
            }
        }
    }

    remove(opHash: Hash) {

        const opHistory = this.contents.get(opHash);

        if (opHistory !== undefined) {

            this.contents.delete(opHistory.opHash);
            this.terminalOps.delete(opHistory.opHash);

            for (const prevOpHash of opHistory.prevOpHashes) {
                this.nextOps.delete(prevOpHash, opHistory.opHash);

                if (this.nextOps.get(prevOpHash).size === 0) {
                    if (this.contents.has(prevOpHash)) {
                        this.terminalOps.add(prevOpHash)
                    } else {
                        this.startingOps.delete(prevOpHash);
                    }
                }
            }
        }

    }

    isValid(startingOpHistories: Map<Hash, Hash|OpCausalHistory>): boolean {

        const verified = new Set<Hash>();
        const checking = new Set<Hash>();

        for (const hash of this.terminalOps) {
            checking.add(hash);
        }

        while (checking.size > 0) {

            const currentOpHash = checking.values().next().value as Hash;

            checking.delete(currentOpHash);

            const currentOp = this.contents.get(currentOpHash) as OpCausalHistory;

            const prevOpHistories = new Map<Hash, Hash|OpCausalHistory>();

            for (const prevOpHash of currentOp.prevOpHashes) {

                if (prevOpHash === currentOpHash) {
                    return false;
                }

                if (verified.has(prevOpHash)) {
                    return false; // cycle detected. bail out.
                }

                const start = startingOpHistories.get(prevOpHash);
                if (start !== undefined) {
                    prevOpHistories.set(prevOpHash, start);
                } else {
                    const op = this.contents.get(prevOpHash);

                    if (op === undefined) {
                        return false;
                    }

                    prevOpHistories.set(prevOpHash, op);

                    if (!verified.has(prevOpHash)) {
                        checking.add(prevOpHash);
                    }
                }
            }

            if (currentOp.verify(prevOpHistories)) {
                verified.add(currentOpHash)
                checking.delete(currentOpHash);
            } else {
                return false;
            }
        }

        return true;

    }

    private isNew(opHash: Hash) {
        return !this.contents.has(opHash);
    }
}

export { CausalHistoryFragment };