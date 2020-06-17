import { Agent, AgentId } from './Agent';
import { Logger, LogLevel } from 'util/logging';

type Event = { type: string, content: any };

enum AgentPodEventType {
    AgentSetChange          = 'agent-set-change',
    ConnectionStatusChange  = 'connection-status-change',
    RemoteAddressListening  = 'remote-address-listening',
};

enum AgentSetChange {
    Addition = 'addition',
    Removal  = 'removal'
};

type AgentSetChangeEvent = {
    type: AgentPodEventType.AgentSetChange,
    content: {
        change: AgentSetChange,
        agentId: AgentId
    }
};

class AgentPod {

    static logger = new Logger(AgentPod.name, LogLevel.INFO);
    
    agents      : Map<string, Agent>;

    constructor() {

        this.agents      = new Map();
    }



    // locally running agent set management

    registerAgent(agent: Agent) {
        this.agents.set(agent.getAgentId(), agent);


        agent.ready(this);

        const ev: AgentSetChangeEvent = {
            type: AgentPodEventType.AgentSetChange,
            content: {
                agentId: agent.getAgentId(),
                change: AgentSetChange.Addition
            }
        }

        this.broadcastEvent(ev)
    }

    deregisterAgent(agent: Agent) {
        this.deregisterAgentById(agent.getAgentId());
    }

    deregisterAgentById(id: AgentId) {

        const ev: AgentSetChangeEvent = {
            type: AgentPodEventType.AgentSetChange,
            content: {
                agentId: id,
                change: AgentSetChange.Removal
            }
        }

        this.broadcastEvent(ev);
        this.agents.delete(id);
    }

    getAgent(id: AgentId) {
        return this.agents.get(id);
    }

    getAgentIdSet() {
        return new Set<AgentId>(this.agents.keys());
    }


    // send an event that will be received by all local agents

    broadcastEvent(ev: Event) {

        AgentPod.logger.trace('Network sending event ' + ev.type + ' with content ' + JSON.stringify(ev.content));

        for (const agent of this.agents.values()) {
            agent.receiveLocalEvent(ev);
        }
    }
    
}

export { AgentPod, Event, AgentPodEventType, AgentSetChangeEvent, AgentSetChange };