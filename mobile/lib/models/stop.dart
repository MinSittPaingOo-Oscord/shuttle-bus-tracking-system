class TramStop {
  final String id;
  final String nameTh;
  final String nameEn;
  final double lat;
  final double lng;
  final String? imageUrl;
  final String status;
  final DateTime createdAt;

  TramStop({
    required this.id,
    required this.nameTh,
    required this.nameEn,
    required this.lat,
    required this.lng,
    this.imageUrl,
    required this.status,
    required this.createdAt,
  });

  factory TramStop.fromJson(Map<String, dynamic> json) {
    return TramStop(
      id: json['id'],
      nameTh: json['nameTh'],
      nameEn: json['nameEn'],
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
      imageUrl: json['imageUrl'],
      status: json['status'],
      createdAt: DateTime.parse(json['createdAt']),
    );
  }
}