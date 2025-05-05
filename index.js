const puppeteer = require('puppeteer');
const { MongoClient } = require('mongodb');

// MongoDB Atlas bağlantı URL'si (bu URL'yi sizden alacağım)
const uri = "mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=AtlasApp";

// Bekleme fonksiyonu
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function startLinkedInSignup() {
    let browser;
    let client;
    try {
        // MongoDB'ye bağlan
        client = new MongoClient(uri);
        await client.connect();
        console.log('MongoDB bağlantısı başarılı...');
        
        const database = client.db("linkedinDB");
        const collection = database.collection("users");
        
        // Kullanıcı bilgilerini çek
        const user = await collection.findOne({ status: "pending" });
        if (!user) {
            throw new Error("Kayıt bekleyen kullanıcı bulunamadı!");
        }
        
        console.log('Kullanıcı bilgileri alındı:', user.email);

        // Launch browser in non-headless mode
        browser = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        console.log('Tarayıcı başlatıldı...');

        // Step 1: Navigate to LinkedIn signup page (Turkish version)
        await page.goto('https://www.linkedin.com/signup?_l=tr', {
            waitUntil: 'networkidle0',
            timeout: 30000
        });
        console.log('LinkedIn Türkçe kayıt sayfasına ulaşıldı...');
        await sleep(2000); // Sayfanın tam yüklenmesi için bekle

        // Step 2: Fill email and password
        await page.waitForSelector('input[id="email-address"]', { visible: true });
        await page.type('input[id="email-address"]', user.email);
        console.log('Email adresi girildi...');
        await sleep(1000); // Kısa bekleme

        await page.waitForSelector('input[id="password"]', { visible: true });
        await page.type('input[id="password"]', user.password);
        console.log('Şifre girildi...');
        await sleep(1000); // Kısa bekleme

        // Step 3: Fill first name and last name
        await page.waitForSelector('input[id="first-name"]', { visible: true });
        await page.type('input[id="first-name"]', user.firstName);
        console.log('İsim girildi...');
        await sleep(1000); // Kısa bekleme

        await page.waitForSelector('input[id="last-name"]', { visible: true });
        await page.type('input[id="last-name"]', user.lastName);
        console.log('Soyisim girildi...');
        await sleep(1000); // Kısa bekleme

        // Step 4: Click join button
        await page.waitForSelector('button[id="join-form-submit"]', { visible: true });
        await page.click('button[id="join-form-submit"]');
        console.log('Kayıt formu gönderildi...');
        await sleep(2000); // Sayfa geçişi için bekle

        // Step 5: Check for security verification
        try {
            // Wait for either security verification or education page
            const securityCheck = await Promise.race([
                page.waitForSelector('div[data-test-id="challenge-form"]', { timeout: 5000, visible: true }),
                page.waitForSelector('button[id="ember16"]', { timeout: 5000, visible: true })
            ]);

            if (securityCheck) {
                if (await securityCheck.evaluate(el => el.id === 'ember16')) {
                    console.log('Güvenlik doğrulaması gerekmedi, eğitim sayfasına geçiliyor...');
                } else {
                    console.log('Güvenlik doğrulaması gerekiyor, lütfen manuel olarak tamamlayın...');
                    await page.waitForNavigation({ waitUntil: 'networkidle0' });
                    console.log('Güvenlik doğrulaması tamamlandı...');
                }
            }
        } catch (error) {
            console.log('Güvenlik doğrulaması gerekmedi, eğitim sayfasına geçiliyor...');
        }

        // Step 6: Fill education information
        await page.waitForSelector('button[id="ember16"]', { visible: true });
        await page.click('button[id="ember16"]');
        console.log('Öğrenci seçeneği seçildi...');
        await sleep(2000); // Sayfa geçişi için bekle

        // Fill university
        await page.waitForSelector('input[id="typeahead-input-for-school-name"]', { visible: true });
        await page.type('input[id="typeahead-input-for-school-name"]', user.education.university);
        await sleep(1000); // Öneriler için bekle
        await page.keyboard.press('Enter');
        console.log('Üniversite bilgisi girildi...');
        await sleep(1000); // Kısa bekleme

        // Select start year
        await page.waitForSelector('select[id="onboarding-profile-edu-start-year"]', { visible: true });
        await page.select('select[id="onboarding-profile-edu-start-year"]', user.education.startDate.year);
        console.log('Başlangıç yılı seçildi...');
        await sleep(1000); // Kısa bekleme

        // Select end year
        await page.waitForSelector('select[id="onboarding-profile-edu-end-year"]', { visible: true });
        await page.select('select[id="onboarding-profile-edu-end-year"]', user.education.endDate.year);
        console.log('Bitiş yılı seçildi...');
        await sleep(1000); // Kısa bekleme

        // Click continue
        await page.waitForSelector('button[data-test-onboarding-profile-education-continue-button="true"]', { visible: true });
        await page.click('button[data-test-onboarding-profile-education-continue-button="true"]');
        console.log('Eğitim bilgileri kaydedildi...');
        await sleep(2000); // Sayfa geçişi için bekle

        // Step 7: Email verification (manual)
        console.log('Lütfen email doğrulama kodunu manuel olarak girin...');
        await page.waitForSelector('input[id="email-confirmation-input"]', { visible: true });
        await page.waitForNavigation({ waitUntil: 'networkidle0' });
        console.log('Email doğrulaması tamamlandı...');

        // Step 8: Select job seeker intent
        await page.waitForSelector('input[id="onboarding-job-seeker-intent-radio-button-PASSIVE"]', { visible: true });
        await page.click('input[id="onboarding-job-seeker-intent-radio-button-PASSIVE"]');
        console.log('İş arama durumu seçildi...');
        await sleep(1000); // Kısa bekleme

        // Click next
        await page.waitForSelector('button[id="ember125"]', { visible: true });
        await page.click('button[id="ember125"]');
        console.log('İleri butonuna tıklandı...');
        await sleep(2000); // Sayfa geçişi için bekle

        // Step 9: Skip additional steps
        await page.waitForSelector('span.artdeco-button__text:has-text("Şimdilik geç")', { visible: true });
        await page.click('span.artdeco-button__text:has-text("Şimdilik geç")');
        console.log('Ek adımlar atlandı...');
        await sleep(2000); // Sayfa geçişi için bekle

        await page.waitForSelector('button[id="ember693"]', { visible: true });
        await page.click('button[id="ember693"]');
        console.log('Geç butonuna tıklandı...');
        await sleep(2000); // Sayfa geçişi için bekle

        // Step 10: Finalize
        await page.waitForSelector('button[id="ember696"]', { visible: true });
        await page.click('button[id="ember696"]');
        console.log('Sonlandır butonuna tıklandı...');
        await sleep(2000); // Sayfa geçişi için bekle

        // Step 11: Wait for redirection to main page
        await page.waitForNavigation({ waitUntil: 'networkidle0' });
        if (page.url().includes('linkedin.com/feed')) {
            console.log('Başarıyla LinkedIn ana sayfasına ulaşıldı!');
            // Kullanıcı durumunu güncelle
            await collection.updateOne(
                { _id: user._id },
                { $set: { status: "completed" } }
            );
            console.log('Kullanıcı durumu güncellendi: completed');
        } else {
            console.log('Ana sayfaya yönlendirilemedi!');
        }

    } catch (error) {
        console.error('Bir hata oluştu:', error);
    } finally {
        // MongoDB bağlantısını kapat
        if (client) {
            await client.close();
        }
        // Keep browser open for manual verification
        // await browser.close();
    }
}

// Start the process
startLinkedInSignup(); 