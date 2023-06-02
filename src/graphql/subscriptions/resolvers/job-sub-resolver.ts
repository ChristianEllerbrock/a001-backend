import { Arg, Root, Subscription } from "type-graphql";
import { JobStateChangePayload } from "../payloads/job-state-change-payload";
import { JobUpdateOutput } from "../../outputs/subscriptions/job-update-output";

export class JobSubResolver {
    @Subscription((returns) => JobUpdateOutput, {
        topics: ["JOB_STATE_CHANGE"],
        filter: (call: { args: any; payload: JobStateChangePayload }) => {
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
    ): Promise<JobUpdateOutput> {
        console.log("sub fired");
        return {
            jobId,
            relay: payload.relay,
            success: payload.success,
            item: payload.item,
            ofItems: payload.ofItems,
        };
    }
}

