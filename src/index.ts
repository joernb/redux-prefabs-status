import { FSA } from "flux-standard-action";
import { Middleware, Reducer } from "redux";

interface BusyStatus {
  statusId: string;
  isBusy: boolean;
}

interface BusyStatusChangedAction extends FSA<BusyStatus> {
  type: "BusyStatusChanged";
  payload: BusyStatus;
}

// TODO maybe implement this as a nesting prefab
export const busyStatus = <
  BeginAction extends FSA<any> = FSA<void>,
  EndAction extends FSA<any> = FSA<void>
>(
  {
    beginType,
    endType,
    statusId = ""
  }: {
    beginType: BeginAction["type"];
    endType: EndAction["type"];
    statusId?: string;
  }
): Middleware =>
  api => next => {
    return (action: BusyStatusChangedAction) => {
      if (action.type === beginType && !action.error) {
        api.dispatch({
          type: "BusyStatusChanged",
          payload: {
            statusId,
            isBusy: true
          }
        } as BusyStatusChangedAction);
        return next(action);
      }
      if (action.type === endType) {
        const result = next(action);
        api.dispatch({
          type: "BusyStatusChanged",
          payload: {
            statusId,
            isBusy: false
          }
        } as BusyStatusChangedAction);
        return result;
      } else {
        return next(action);
      }
    };
  };

export const trackStatus = <
  BusyAction extends FSA<any> = FSA<void>,
  ReadyAction extends FSA<any> = FSA<void>
>(
  {
    busyType,
    mapBusy = () => undefined,
    readyType,
    mapReady = () => undefined,
    statusId = ""
  }: {
    busyType?: BusyAction["type"];
    mapBusy?: () => BusyAction["payload"];
    readyType?: ReadyAction["type"];
    mapReady?: () => ReadyAction["payload"];
    statusId?: string;
  }
): Middleware =>
  api => next => {

    let timeoutHandle: number | null = null;

    // slightly delayed action dispatch, can be canceled
    const scheduleReadyDispatch = () => {
      console.log("scheduleReadyDispatch in a few seconds");
      timeoutHandle = setTimeout(
        () => {
          try {
            console.log("scheduleReadyDispatch now");
            api.dispatch({
              type: readyType,
              payload: mapReady()
            });
          } catch (error) {
            api.dispatch({
              type: readyType,
              payload: error,
              error: true
            })
          }
        },
        0
      );
    }

    let counter = 0;

    // initially schedule a ready dispatch in case no busy status changes are triggered at all
    scheduleReadyDispatch();

    return (action: BusyStatusChangedAction) => {
      const result = next(action);

      if (action.type === "BusyStatusChanged" && action.payload.statusId === statusId) {
        // every status change cancels a scheduled dispatch
        if (timeoutHandle !== null) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }

        // update counter
        counter = counter + (action.payload.isBusy === true ? 1 : -1);

        if (counter === 0 && action.payload.isBusy === false) {
          // now ready
          if (readyType) {
            scheduleReadyDispatch();
          }
        } else if (counter === 1 && action.payload.isBusy === true) {
          // now busy
          if (busyType) {
            try {
              api.dispatch({
                type: busyType,
                payload: mapBusy()
              });
            } catch (error) {
              api.dispatch({
                type: busyType,
                payload: error,
                error: true
              })
            }
          }
        }
      }

      return result;
    };
  };

export type BusyStatusCounterState = number;

export const busyStatusCounter = (
  {
    statusId = ""
  }: {
    statusId?: string;
  }
): Reducer<BusyStatusCounterState> =>
  (state: BusyStatusCounterState = 0, action: BusyStatusChangedAction) => {
    if (action.type === "BusyStatusChanged" && action.payload.statusId === statusId) {
      return state + (action.payload.isBusy === true ? 1 : -1);
    }
    return state;
  };
