exports.Serializable = class Serializable
  __type = 'Serializable'

  constructor: ->
    @__type = @__type

  afterDeserialize: ->
    # override me

  eachKey: (key, value) ->
    undefined

  @buildClassMap: (objects...) ->
    res = {}
    for object in objects
      res[object.prototype.__type] = object
    res

  @buildMap: (maps...) ->
    res = {}
    for id, map of maps
      for key, val of map
        res[key] = val
    res

  @deserialize: (object, prototypes) ->
    if object? and typeof object == 'object'
      if object.__type?
        object.__proto__ = prototypes[object.__type].prototype
      
      for key, value of object
        val = undefined
        if object.__type?
          val = object.eachKey key, value

        if val == undefined and typeof value == 'object'
          @deserialize(value, prototypes)
        else if val != undefined
          object[key] = val
      
      if object.__type?
        object.afterDeserialize()
