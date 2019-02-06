import { FSA } from "flux-standard-action";
import { Middleware, Reducer } from "redux";

interface BusyStatusChangedAction extends FSA<boolean> {
  type: "BusyStatusChanged";
}

export const busyStatus = <
  BeginAction extends FSA<any> = FSA<void>,
  EndAction extends FSA<any> = FSA<void>
> (
  {
    beginType,
    endType
  }: {
    beginType: BeginAction["type"];
    endType: EndAction["type"];
  }
): Middleware =>
  api => next => {
    let counter = 0;
    return (action: BusyStatusChangedAction) => {
      const result = next(action);

      if (action.type === beginType) {
        api.dispatch({
          type: "BusyStatusChanged",
          payload: true
        } as BusyStatusChangedAction);
      }
      if (action.type === endType) {
        api.dispatch({
          type: "BusyStatusChanged",
          payload: false
        } as BusyStatusChangedAction);
      }

      return result;
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
    mapReady = () => undefined
  }: {
    busyType?: BusyAction["type"];
    mapBusy?: () => BusyAction["payload"];
    readyType?: ReadyAction["type"];
    mapReady?: () => ReadyAction["payload"];
  }
): Middleware =>
  api => next => {
    let counter = 0;
    let statusNeverChanged = true;

    // automatically emit ready action if no status changes were received during initialization
    setTimeout(() => {
      if (counter === 0 && statusNeverChanged) {
        api.dispatch({
          type: readyType,
          payload: mapReady()
        });
      }
    }, 0);

    return (action: BusyStatusChangedAction) => {
      const result = next(action);

      if (action.type === "BusyStatusChanged") {
        // update counter
        counter = counter + (action.payload === true ? 1 : -1);
        // set changed flag
        statusNeverChanged = false;
        // trigger hook when counter reaches 0
        if (counter === 0) {
          if (readyType) {
            try {
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
          }
        } else {
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

export const busyStatusCounter = (): Reducer<BusyStatusCounterState> =>
  (state: BusyStatusCounterState = 0, action: BusyStatusChangedAction) => {
    if (action.type === "BusyStatusChanged") {
      return state + (action.payload === true ? 1 : -1);
    }
    return state;
  };
