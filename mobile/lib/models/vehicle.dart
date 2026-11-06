class Vehicle {
  final String id;
  final String name;
  final String type;
  final String? assignedRouteId;
  final String status;
  final DateTime createdAt;

  Vehicle({
    required this.id,
    required this.name,
    required this.type,
    this.assignedRouteId,
    required this.status,
    required this.createdAt,
  });

  factory Vehicle.fromJson(Map<String, dynamic> json) {
    return Vehicle(
      id: json['id'],
      name: json['name'],
      type: json['type'],
      assignedRouteId: json['assignedRouteId'],
      status: json['status'],
      createdAt: DateTime.parse(json['createdAt']),
    );
  }
}