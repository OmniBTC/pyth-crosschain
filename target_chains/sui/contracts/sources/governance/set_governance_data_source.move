module pyth::set_governance_data_source {
    use pyth::deserialize;
    use pyth::data_source;
    use pyth::state::{Self, State, LatestOnly};
    use pyth::governance_action::{Self};
    use pyth::governance_witness::{Self, GovernanceWitness};

    use pyth_wormhole::cursor;
    use pyth_wormhole::external_address::{Self, ExternalAddress};
    use pyth_wormhole::bytes32::{Self};
    use pyth_wormhole::governance_message::{Self, DecreeTicket};

    friend pyth::governance;

    struct GovernanceDataSource {
        emitter_chain_id: u64,
        emitter_address: ExternalAddress,
        initial_sequence: u64,
    }

    public fun authorize_governance(
        pyth_state: &State,
        global: bool
    ): DecreeTicket<GovernanceWitness> {
        if (global){
            governance_message::authorize_verify_global(
                governance_witness::new_governance_witness(),
                state::governance_chain(pyth_state),
                state::governance_contract(pyth_state),
                state::governance_module(),
                governance_action::get_value(governance_action::new_set_governance_data_source())
            )
        } else {
            governance_message::authorize_verify_local(
                governance_witness::new_governance_witness(),
                state::governance_chain(pyth_state),
                state::governance_contract(pyth_state),
                state::governance_module(),
                governance_action::get_value(governance_action::new_set_governance_data_source())
            )
        }
    }

    public(friend) fun execute(latest_only: &LatestOnly, pyth_state: &mut State, payload: vector<u8>) {
        let GovernanceDataSource { emitter_chain_id, emitter_address, initial_sequence: initial_sequence } = from_byte_vec(payload);
        state::set_governance_data_source(latest_only, pyth_state, data_source::new(emitter_chain_id, emitter_address));
        state::set_last_executed_governance_sequence(latest_only, pyth_state, initial_sequence);
    }

    fun from_byte_vec(bytes: vector<u8>): GovernanceDataSource {
        let cursor = cursor::new(bytes);
        let emitter_chain_id = deserialize::deserialize_u16(&mut cursor);
        let emitter_address = external_address::new(bytes32::from_bytes(deserialize::deserialize_vector(&mut cursor, 32)));
        let initial_sequence = deserialize::deserialize_u64(&mut cursor);
        cursor::destroy_empty(cursor);
        GovernanceDataSource {
            emitter_chain_id: (emitter_chain_id as u64),
            emitter_address,
            initial_sequence
        }
    }
}
