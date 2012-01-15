exports.Serializable = class Serializable
  __type = 'Serializable'

  constructor: ->
    @__type = @__type

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
        if typeof value == 'object'
          @deserialize(value, prototypes)
