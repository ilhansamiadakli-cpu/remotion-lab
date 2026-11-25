# Sistem Arkeolojisi: Doom ve Half-Life (GoldSrc) Nasıl 4 MB RAM ve 33 MHz CPU İle 3D Dünya Çizdi?

## Bölüm 1: Donanım Darboğazı ve Z-Buffer İmkânsızlığı

Bugün sıradan bir tarayıcı sekmesi bile yüzlerce megabayt bellek tüketiyor. Oysa 1993 yılında Doom ve birkaç yıl sonra Half-Life motoru GoldSrc, yalnızca 4 MB RAM ve 33 MHz hızında tek çekirdekli bir 486DX CPU üzerinde gerçek zamanlı 3D dünyalar çiziyordu.

Üstelik ortada donanımsal bir GPU ve megabaytlarca VRAM yoktu. Akıcı bir oyun için elinizdeki tüm kare bütçesi sadece 16.6 milisaniyeydi. Modern motorların vazgeçilmezi olan Z-Buffer tekniği bu donanımda tamamen imkânsızdı.

Çünkü her piksel için derinlik karşılaştırması yapmak, hem kısıtlı bellek bant genişliğini boğuyor hem de duvarların arkasında kalan görünmez yüzeyleri boşuna hesaplayarak CPU'yu kilitliyordu. John Carmack bu darboğazı aşmak için kuralı kökten değiştirdi: pahalı hesapları çalışma anından çıkarıp harita derleme anına taşıdı.

## Bölüm 2: BSP Ağaçları ve Derleme Anında Düzlem Bölünmesi

Bu devrimin ilk sütunu BSP, yani Binary Space Partitioning ağaçlarıydı. Harita henüz oyuncunun bilgisayarına ulaşmadan, offline derleme aşamasında tüm duvarlar ve yüzeyler düzlemlerle özyinelemeli olarak ikiye bölünür.

Ortaya haritanın tüm geometrisini dışbükey odacıklara ayıran statik bir ikili ağaç çıkar. Oyun çalışırken motor her karede binlerce poligonu sıralamak zorunda kalmaz.

Kamera koordinatı kök düğümdeki düzleme karşı tek bir işaret testiyle kontrol edilir. Kamera düzlemin önündeyse önce ön dal, ardından arka dal gezilir. Böylece tüm sahne önden arkaya kesin bir derinlik sırasıyla taranır. Ekranda bir piksel dolduğu anda arkasındaki hiçbir duvar bir daha çizilmez; Z-Buffer olmadan mükemmel gizleme ve sıfır overdraw sağlanır.

## Bölüm 3: PVS Görünürlük Matrisi ve Lightmap Pişirme

Quake ve Half-Life'ın kullandığı GoldSrc motoruyla tam 3D koridorlara geçildiğinde BSP tek başına yeterli değildi. Çünkü kamera bir odadayken duvarın arkasındaki elli odanın düğümlerini dolaşmak hâlâ CPU zamanını harcıyordu.

Çözüm PVS, yani Potentially Visible Set oldu. Derleyici haritadaki her oda çifti arasında ışık geçiren bir görüş hattı olup olmadığını önceden hesaplar ve sonucu sıkıştırılmış bir bit matrisine gömer.

Oyuncu bir odaya girdiğinde motor sadece tek bir bit vektörünü açar; sıfır olan tüm görünmez odalar tek hamlede elenir. Aynı felsefe aydınlatmada da uygulandı. Gerçek zamanlı gölge hesaplamak yerine Radiosity algoritmasıyla yumuşak ışıklar önceden Lightmap dokularına pişirildi. Çalışma anında CPU sadece hazır ışığı yüzey dokusuyla çarparak sinematik atmosferi bedavaya getirdi.

## Bölüm 4: Zone, Hunk Bellek Yöneticisi ve WebAssembly Mirası

Ancak hız yalnızca grafikle bitmez; asıl sessiz katil bellek parçalanmasıdır. 4 MB RAM içinde her nesne için standart C malloc ve free çağrıları yaparsanız, bellek delik deşik olur ve kare süreleri aniden sıçrar.

Doom bunu kendi Zone bellek yöneticisi Z_Malloc ile, Quake ve GoldSrc ise doğrusal Hunk arena mimarisiyle çözdü. Motor açılışta tüm boş RAM'i tek bir blok halinde ayırır. Harita yüklenirken veriler sadece tek bir pointer ileri kaydırılarak peş peşe yazılır.

Bölüm bittiğinde binlerce ayrı free çağrısı yapmak yerine, tek bir pointer başlangıç adresine sıfırlanır ve tüm bellek mikrosaniyeler içinde tertemiz olur. İşletim sistemine bağımlı olmayan bu deterministik saf C mimarisi o kadar sağlamdı ki, bugün Xash3D motoruyla WebAssembly'e derlenip doğrudan tarayıcıda bile akıcı şekilde çalışabiliyor.
