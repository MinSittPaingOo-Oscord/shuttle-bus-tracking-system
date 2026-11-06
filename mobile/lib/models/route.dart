class TramRoute {
  final String id;
  final String name;
  final String color;
  final String status;
  final DateTime createdAt;

  TramRoute({
    required this.id,
    required this.name,
    required this.color,
    required this.status,
    required this.createdAt,
  });

  factory TramRoute.fromJson(Map<String, dynamic> json) {
    return TramRoute(
      id: json['id'],
      name: json['name'],
      color: json['color'],
      status: json['status'],
      createdAt: DateTime.parse(json['createdAt']),
    );
  }
}