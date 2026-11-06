class RouteStop {
  final String id;
  final String routeId;
  final String stopId;
  final int stopOrder;
  final RouteStopInfo? stop;

  RouteStop({
    required this.id,
    required this.routeId,
    required this.stopId,
    required this.stopOrder,
    this.stop,
  });

  factory RouteStop.fromJson(Map<String, dynamic> json) {
    return RouteStop(
      id: json['id'],
      routeId: json['routeId'],
      stopId: json['stopId'],
      stopOrder: json['stopOrder'],
      stop: json['stop'] != null
          ? RouteStopInfo.fromJson(json['stop'])
          : null,
    );
  }
}

class RouteStopInfo {
  final String id;
  final String nameTh;
  final String nameEn;
  final String? imageUrl;
  final String status;
  final DateTime createdAt;

  RouteStopInfo({
    required this.id,
    required this.nameTh,
    required this.nameEn,
    this.imageUrl,
    required this.status,
    required this.createdAt,
  });

  factory RouteStopInfo.fromJson(Map<String, dynamic> json) {
    return RouteStopInfo(
      id: json['id'],
      nameTh: json['nameTh'],
      nameEn: json['nameEn'],
      imageUrl: json['imageUrl'],
      status: json['status'],
      createdAt: DateTime.parse(json['createdAt']),
    );
  }
}