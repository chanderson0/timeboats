exports.Point = class Point
  @getAngleDeg: (x, y) ->
    return @getAngle(x, y) * 180 / Math.PI

  @getAngle: (x, y) ->
    return Math.atan2(y, x)
  
  @add: (x1, y1, x2, y2) ->
    return { x: x1 + x2, y: y1 + y2 }

  @subtract: (x1, y1, x2, y2) ->
    return { x: x1 - x2, y: y1 - y2 }
  
  @getDistance: (x1, y1, x2, y2) ->
    x = x1 - x2
    y = y1 - y2
    return Math.sqrt(x * x + y * y)

  @getLength: (x, y) ->
    Math.sqrt(x * x + y * y)

  @normalize: (x, y, length = 1) ->
    current = @getLength x, y
    scale = if current != 0 then length / current else 0
    return { x: x * scale, y: y * scale }
