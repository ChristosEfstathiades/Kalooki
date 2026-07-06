import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'avatars.show': { paramsTuple: [ParamValue]; params: {'filename': ParamValue} }
    'auth.new_account.store': { paramsTuple?: []; params?: {} }
    'auth.access_tokens.store': { paramsTuple?: []; params?: {} }
    'profile.profile.show': { paramsTuple?: []; params?: {} }
    'profile.access_tokens.destroy': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'avatars.show': { paramsTuple: [ParamValue]; params: {'filename': ParamValue} }
    'profile.profile.show': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'avatars.show': { paramsTuple: [ParamValue]; params: {'filename': ParamValue} }
    'profile.profile.show': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'auth.new_account.store': { paramsTuple?: []; params?: {} }
    'auth.access_tokens.store': { paramsTuple?: []; params?: {} }
    'profile.access_tokens.destroy': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}