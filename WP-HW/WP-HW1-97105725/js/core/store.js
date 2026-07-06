(function (app) {
  "use strict";

  /** @typedef {{id:string,title:string,content:string,folderId:(string|null),isPinned:boolean,createdAt:string,updatedAt:string}} Note */
  /** @typedef {{id:string,name:string,createdAt:string,updatedAt:string}} Folder */
  /** @typedef {{schemaVersion:number,settings:{locale:string,theme:string,sortMode:string},folders:Folder[],notes:Note[],ui:{selectedNoteId:(string|null),collapsedFolderIds:string[]}}} AppState */

  var listeners = [];
  var state = app.ValidationService.normalizeForRuntime(app.StorageService.load());

  function notify() {
    listeners.forEach(function (listener) {
      listener(getState());
    });
  }

  function persistAndNotify() {
    app.StorageService.save(state);
    notify();
  }

  function getState() {
    return app.ValidationService.cloneState(state);
  }

  function mutate(mutator) {
    var draft = app.ValidationService.cloneState(state);
    mutator(draft);
    var validation = app.ValidationService.validateState(draft);
    if (!validation.ok) {
      throw new Error("Invalid state mutation: " + validation.reason);
    }
    state = app.ValidationService.cloneState(draft);
    persistAndNotify();
    return getState();
  }

  function replace(nextState) {
    var validation = app.ValidationService.validateState(nextState);
    if (!validation.ok) {
      return validation;
    }
    state = app.ValidationService.cloneState(nextState);
    persistAndNotify();
    return { ok: true };
  }

  function subscribe(listener) {
    listeners.push(listener);
    listener(getState());
    return function () {
      listeners = listeners.filter(function (current) {
        return current !== listener;
      });
    };
  }

  app.Store = {
    getState: getState,
    mutate: mutate,
    replace: replace,
    subscribe: subscribe
  };
}(window.NotionLite));
