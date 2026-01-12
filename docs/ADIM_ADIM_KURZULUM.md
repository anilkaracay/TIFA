# TIFA Projesi - Adım Adım Deploy Rehberi (Türkçe)

Bu rehber, projeyi arkadaşlarınızla paylaşabilmeniz için **Frontend** tarafını Vercel'e, **Backend** tarafını ise canlıya nasıl alacağınızı adım adım anlatır.

> **ÖNEMLİ NOT:** Bu proje iki ana parçadan oluşur:
> 1. **Frontend (Arayüz):** Kullanıcıların gördüğü kısım. Vercel'de çalışır.
> 2. **Backend (API):** Verilerin işlendiği kısım. Vercel'in standart yapısına uygun değildir (devamlı çalışan bir sunucudur), bu yüzden Backend için farklı bir yöntem (Railway, Render vb. veya kendi bilgisayarınızdan tünelleme) kullanmanız gerekir.

---

## 1. Hazırlık
Kodunuzdaki son hatalar giderildi. Öncelikle bu son halini GitHub'a yüklediğinizden ("push" ettiğinizden) emin olun.

```bash
git add .
git commit -m "Deploy oncesi duzeltmeler"
git push
```

---

## 2. Frontend'i Vercel'e Yükleme (Adım Adım)

1. **Vercel'e Giriş Yapın:** [vercel.com](https://vercel.com) adresine gidin ve GitHub hesabınızla giriş yapın.
2. **Yeni Proje Oluşturun:**
   - Dashboard'da **"Add New..."** butonuna tıklayın ve **"Project"**i seçin.
   - GitHub'daki **TIFA** (veya projenizin adı neyse) reposunun yanındaki **"Import"** butonuna tıklayın.
3. **Proje Ayarlarını Yapın (Çok Önemli!):**
   - "Configure Project" ekranında **Framework Preset** otomatik olarak `Next.js` seçili olmalıdır.
   - **Root Directory** kısmında "Edit" butonuna basın ve **`frontend`** klasörünü seçin. (Bunu yapmazsanız deploy başarısız olur çünkü proje bir monorepo).
4. **Deploy:**
   - **"Deploy"** butonuna basın.
   - Vercel projeyi derleyip yayına alacaktır. İşlem bitince size bir domain (örn: `tifa-frontend.vercel.app`) verecek.

---

## 3. Backend (API) Sorunu ve Çözümü

Frontend açıldığında muhtemelen "Veriler yüklenemiyor" veya "Network Error" hatası alacaksınız. Çünkü Frontend, verileri çekmek için bir Backend'e ihtiyaç duyar. Varsayılan olarak Backend sizin bilgisayarınızdaki `localhost:4000` adresinde çalışıyor ama arkadaşlarınızın bilgisayarı bu adrese erişemez.

### Seçenek A: Hızlı Demo (Ngrok Kullanarak)
Eğer sadece kısa süreliğine arkadaşlarınıza göstermek istiyorsanız ve Backend'i bir sunucuya kurmakla uğraşmak istemiyorsanız:

1. Kendi bilgisayarınızda Backend'i çalıştırın (Terminalde ana dizinde `pnpm dev` veya `start-panel.sh` ile).
2. **Ngrok** uygulamasını indirin ve kurun ([ngrok.com](https://ngrok.com)).
3. Yeni bir terminal açıp şu komutu yazın: `ngrok http 4000`
4. Ngrok size `https://xxxx-xxxx.ngrok-free.app` gibi bir adres verecek. Bu adres, sizin bilgisayarınızdaki Backend'i dünyaya açar.
5. Vercel Dashboard'a gidin -> Projeniz -> **Settings** -> **Environment Variables**.
6. Yeni bir değişken ekleyin:
   - **Key:** `NEXT_PUBLIC_BACKEND_URL`
   - **Value:** (Ngrok'un verdiği https ile başlayan adres)
7. **Deployments** sekmesine gidin, son deploy'un yanındaki üç noktaya basıp **"Redeploy"** diyerek Frontend'in yeni adresi tanımasını sağlayın.

### Seçenek B: Kalıcı Kurulum (Railway/Render)
Eğer Backend sürekli açık kalsın istiyorsanız (bilgisayarınızı kapatsanız bile):

1. **Railway.app** veya **Render.com** gibi bir servise üye olun.
2. GitHub reponuzu bağlayın.
3. Root Directory olarak `backend` seçin.
4. Başlangıç komutu (Start Command) olarak `pnpm start` veya `node dist/server.js` ayarlandığından emin olun.
5. Size verilen canlı Backend URL'ini kopyalayın.
6. Seçenek A'daki 5. ve 6. adımları uygulayarak bu URL'i Vercel'e ekleyin.

---

## Özet Kontrol Listesi
- [ ] Değişiklikler GitHub'a yollandı.
- [ ] Vercel'de `frontend` klasörü Root Directory seçilerek proje oluşturuldu.
- [ ] Backend bir şekilde (Ngrok veya Sunucu) internete açıldı.
- [ ] Backend adresi `NEXT_PUBLIC_BACKEND_URL` olarak Vercel'e eklendi ve Redeploy yapıldı.
