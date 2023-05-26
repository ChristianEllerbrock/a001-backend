import { Arg, Root, Subscription } from "type-graphql";
import { JobStateChangePayload } from "../../payloads/job-state-change-payload";
import { LoginJobUpdateOutput } from "../../outputs/subscriptions/login-job-update-output";

export class JobSubResolver {
    @Subscription((returns) => LoginJobUpdateOutput, {
        topics: ["JOB_STATE_CHANGE"],
        filter: (call: { args: any; payload: JobStateChangePayload }) => {
            console.log(call.args);

            if (
                call.args.pubkey === call.payload.destinationFilter.pubkey &&
                call.args.jobId === call.payload.destinationFilter.jobId
            ) {
                return true;
            }

            return false;
        },
    })
    async jobStateChange(
        @Arg("pubkey") pubkey: string,
        @Arg("jobId") jobId: string,
        @Root() payload: JobStateChangePayload
    ): Promise<LoginJobUpdateOutput> {
        return {
            jobId,
            relay: payload.relay,
            success: payload.success,
            item: payload.item,
            ofItems: payload.ofItems,
        };
    }
}

