import { Button } from "../components/Button";
import Icon from "../components/Icon";

export const ErrorPage = () => {
    return (
      <div className="flex flex-col justify-center items-center w-screen h-screen bg-neutral-950 text-white gap-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 animate-pulse select-none">
          <Icon iconName="warning" color="#ef4444" fontSize="28px" />
        </div>

        <h1 className="text-2xl font-semibold">Sorry, it looks like we're down</h1>
        <p className="text-neutral-400 text-sm text-center max-w-sm">
          Something went wrong while connecting to your room.
          Please try again in a moment.
        </p>

        <Button
          onClick={() => window.location.reload()}
          className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-md px-4 py-2 mt-4 text-sm font-medium transition-colors"
        >
          Try Again
        </Button>
      </div>
    );
}