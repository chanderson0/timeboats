GameObject = require('./game_object.coffee').GameObject
Point = require('./point.coffee').Point
Map = require('./map.coffee').Map

exports.Explosion = class Explosion extends GameObject
  __type: 'Explosion'

  constructor: (@id, @x, @y, @max_radius) ->
    super @id, @x, @y
    @radius = 0
    Map.getInstance().damageAt @x, @y, @max_radius

  clone: ->
    exp = new Explosion @id, @x, @y, @max_radius
    exp.radius = @radius
    return exp

  update: (dt, state) ->
    @radius += dt * 100

    for id, object of state.objects
      if object.__type == 'Square' and Point.getDistance(@x, @y, object.x, object.y) < @radius
        object.explode state

    super dt, state
    if @radius >= @max_radius
      state.removeObject @id

  draw: (context) ->
    context.save()
    context.translate @x, @y
    context.beginPath()
    context.arc 0, 0, @radius, 0, Math.PI*2, true
    context.closePath()
    context.stroke()
    context.restore()