# Otel Rezervasyon ve Konaklama Yönetim Sistemi

## Bölüm 1: Giriş ve Temel Problem

Bir otel rezervasyon sistemi dışarıdan bakıldığında basit bir kayıt ekranı gibi görünür. Müşteri gelir, tarih seçer, odayı tutar. Ama işin mutfağına indiğinizde asıl mesele ekran tasarımı değil, veri tutarlılığıdır.

Aynı odanın aynı tarihlerde iki farklı kişiye satılmasını nasıl engellersiniz? Ya da bir rezervasyon iptal edildiğinde ödeme, oda durumu ve fiyat geçmişi birbirine karışmadan nasıl güncellenir?

Bu projede tam olarak bu problemlere odaklandım. MySQL 8.0 ve Spring Boot kullanarak, 13 tablodan oluşan, tamamen 3NF kurallarına uygun bir Otel Rezervasyon ve Konaklama Yönetim Sistemi tasarladım.

## Bölüm 2: 13 Tablolu 3NF Mimari

Çoğu başlangıç projesinde yapılan en büyük hata, tüm bilgileri tek bir devasa rezervasyon tablosuna yığmaktır. Müşteri adı, oda tipi, fiyat, ödeme bilgisi hepsi yan yana durur. Kısa vadede kolay görünür ama bir oda fiyatını güncellediğinizde eski faturalar bozulur, veri tekrarı başlar.

Biz bu sistemi en baştan 3NF disipliniyle 13 ayrı tabloya böldük. Müşteriler, odalar, oda tipleri, rezervasyonlar, ödemeler ve ekstra hizmetler birbirinden net sınırlarla ayrıldı. Her tablonun tek bir sorumluluğu var.

Yabancı anahtarlar yani Foreign Key kısıtlamaları sayesinde, sistemde olmayan bir odaya rezervasyon düşmesi ya da karşılığı olmayan bir ödeme kaydı oluşması daha veritabanı seviyesinde engelleniyor.

## Bölüm 3: Eşzamanlılık, Transaction ve Çakışma Yönetimi

Peki sistemin gerçek sınavı ne zaman başlar? Aynı saniyede iki farklı kullanıcı son kalan 204 numaralı odayı ayırtmaya çalıştığında.

Eğer bu kontrolü sadece uygulama tarafında basit bir if bloğuyla yaparsanız, iki istek aynı anda geçer ve çifte rezervasyon hatası oluşur.

Bunu çözmek için Spring Boot tarafında @Transactional yapısını ve MySQL InnoDB satır kilitleme mekanizmasını devreye aldık. Bir rezervasyon isteği geldiğinde önce tarih çakışması veritabanı seviyesinde kilitlenerek kontrol ediliyor. İlk gelen istek 201 Created yanıtıyla işlemi güvenle tamamlarken, milisaniyeler sonra gelen ikinci istek doğrudan 409 Conflict hatasıyla geri çevriliyor. Ya tüm adımlar eksiksiz tamamlanıyor ya da en ufak bir hatada sistem kendini tamamen geri sarıyor.

## Bölüm 4: Trigger'lar, Stored Procedure ve Performans

İş mantığının sadece Java kodunda yaşamaması, veritabanının da kendi bütünlüğünü koruması gerekiyor. Bu yüzden kritik noktalarda Trigger ve Stored Procedure yapıları kurduk.

Örneğin müsait odaları listelerken uygulama tarafına binlerce gereksiz satır çekmek yerine, doğrudan MySQL içinde çalışan saklı yordamlarla sadece tarih aralığına uyan boş odaları filtreliyoruz.

Ayrıca rezervasyon durumu değiştiğinde oda durumunu veya log kayıtlarını otomatik güncelleyen tetikleyiciler sayesinde, insan hatasına veya unutulan bir sorguya yer kalmıyor. Doğru kolonlara eklenen indekslerle birlikte, normalde yüzlerce milisaniye süren sorgular tek haneli milisaniyelere iniyor.

## Bölüm 5: Kapanış

Özetle bu proje, sadece veri ekleyen ve silen standart bir CRUD uygulaması değil. 13 tablolu temiz şeması, 3NF kuralları, işlem bütünlüğü ve çakışma korumasıyla gerçek bir konaklama sisteminin çekirdeğini modelleyen bir mimari.

Tüm SQL şemasına, ER diyagramına ve kaynak kodlara GitHub reposu üzerinden ulaşabilirsiniz. İzlediğiniz için teşekkürler.
