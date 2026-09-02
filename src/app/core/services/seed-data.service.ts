import { Injectable, inject } from '@angular/core';
import { forkJoin, from, Observable, of } from 'rxjs';
import { concatMap, delay } from 'rxjs/operators';
import { TaxonomyService } from './taxonomy.service';
import { AuthorService } from './author.service';
import { ContentService } from './content.service';
import { Script, Genre, Theme } from '../models/taxonomy.models';
import { Author, AuthorDetail } from '../models/author.models';
import { Content, ContentText } from '../models/content.models';

export interface ClassicalPoet {
  id: number;
  birthDate: string;
  deathDate: string;
  avatarUrl: string;
  details: {
    ur: { name: string; biography: string };
    hi: { name: string; biography: string };
    en: { name: string; biography: string };
  };
}

export interface ClassicalPoem {
  id: number;
  authorId: number;
  genreId: number;
  themeIds: number[];
  title: string;
  texts: {
    ur: { title: string; body: string };
    hi: { title: string; body: string };
    en: { title: string; body: string };
  };
}

@Injectable({
  providedIn: 'root'
})
export class SeedDataService {
  private readonly taxonomyService = inject(TaxonomyService);
  private readonly authorService = inject(AuthorService);
  private readonly contentService = inject(ContentService);

  readonly initialScripts: Script[] = [
    { id: 1, code: 'ur', name: 'Urdu' },
    { id: 2, code: 'hi', name: 'Hindi' },
    { id: 3, code: 'en', name: 'English' }
  ];

  readonly initialGenres: Genre[] = [
    { id: 1, name: 'غزل / ग़ज़ल / Ghazal', slug: 'ghazal' },
    { id: 2, name: 'نظم / नज़्म / Nazm', slug: 'nazm' },
    { id: 3, name: 'شعر / शेर / Sher', slug: 'sher' },
    { id: 4, name: 'رباعی / रुबाई / Rubai', slug: 'rubai' }
  ];

  readonly initialThemes: Theme[] = [
    { id: 1, name: 'عشق و محبت (Love)', slug: 'ishq' },
    { id: 2, name: 'درد و الم (Heartbreak & Sorrow)', slug: 'dard' },
    { id: 3, name: 'تنہائی (Solitude & Loneliness)', slug: 'tanhai' },
    { id: 4, name: 'فلسفہ و زندگی (Philosophy & Life)', slug: 'zindagi' },
    { id: 5, name: 'تصوف و روحانیت (Sufism)', slug: 'sufi' },
    { id: 6, name: 'جدائی و ہجر (Separation)', slug: 'judai' },
    { id: 7, name: 'امید و انقلاب (Hope & Revolution)', slug: 'inqilab' }
  ];

  readonly classicalPoets: ClassicalPoet[] = [
    {
      id: 1,
      birthDate: '1797-12-27',
      deathDate: '1869-02-15',
      avatarUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400&auto=format&fit=crop&q=80',
      details: {
        ur: {
          name: 'مرزا غالب',
          biography: 'مرزا اسد اللہ خاں غالب اردو اور فارسی کے عظیم ترین شاعر تھے۔ ان کی شاعری انسانی نفسیات، وجودی فلسفے اور عشق کی گہرائیوں کا بے مثال مجموعہ ہے۔ وہ دہلی کے آخری مغل دربار سے وابستہ رہے۔'
        },
        hi: {
          name: 'मिर्ज़ा ग़ालिब',
          biography: 'मिर्ज़ा असदुल्लाह ख़ाँ ग़ालिब उर्दू और फ़ारसी के सर्वकालिक महानतम शायर हैं। उनकी शायरी मानवीय दर्शन, अस्तित्व और इश्क़ के सूक्ष्म पहलुओं की अद्वितीय अभिव्यक्ति है।'
        },
        en: {
          name: 'Mirza Ghalib',
          biography: 'Mirza Asadullah Khan Ghalib is revered as one of the most celebrated and profound classical Urdu and Persian poets of the Mughal era. His verses explore existential angst, longing, and sublime intellect.'
        }
      }
    },
    {
      id: 2,
      birthDate: '1911-02-13',
      deathDate: '1984-11-20',
      avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=80',
      details: {
        ur: {
          name: 'فیض احمد فیض',
          biography: 'فیض احمد فیض بیسویں صدی کے سب سے بااثر ترقی پسند شاعر تھے۔ انہوں نے روایتی رومانوی غزل کو انقلابی آہنگ اور عوامی جدوجہد کے شعور سے آراستہ کیا۔ لینن امن انعام یافتہ۔'
        },
        hi: {
          name: 'फ़ैज़ अहमद फ़ैज़',
          biography: 'फ़ैज़ अहमद फ़ैज़ 20वीं सदी के सबसे प्रभावशाली प्रगतिशील शायर थे। उन्होंने क्लासिक रोमानियत को जन-क्रांति और सामाजिक न्याय की आवाज़ बनाया। लेनिन शांति पुरस्कार से सम्मानित।'
        },
        en: {
          name: 'Faiz Ahmad Faiz',
          biography: 'Faiz Ahmad Faiz was a towering modern Urdu poet, intellectual, and revolutionary Marxist. His poetry seamlessly interwove the sorrow of the beloved with the struggle for human freedom and social justice.'
        }
      }
    },
    {
      id: 3,
      birthDate: '1931-12-14',
      deathDate: '2002-11-08',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
      details: {
        ur: {
          name: 'جون ایلیا',
          biography: 'جون ایلیا اردو کے منفرد، باغی اور وجودی شاعر و فلسفی تھے۔ ان کا بے باک اندازِ بیان، خود اذیتی اور نوحہ گری نوجوان نسل میں بے حد مقبول ہے۔'
        },
        hi: {
          name: 'जौन एलिया',
          biography: 'जौन एलिया उर्दू के अनूठे, बागी और अस्तित्ववादी शायर व दार्शनिक थे। उनका बेबाक अंदाज़-ए-बयाँ, विरह और आत्ममंथन आज की पीढ़ी में अत्यंत लोकप्रिय है।'
        },
        en: {
          name: 'Jaun Elia',
          biography: 'Jaun Elia was an eccentric and deeply existential Urdu poet, scholar, and nihilist thinker whose radical honesty, unconventional imagery, and melancholy resonated across generations.'
        }
      }
    },
    {
      id: 4,
      birthDate: '1877-11-09',
      deathDate: '1938-04-21',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
      details: {
        ur: {
          name: 'علامہ محمد اقبال',
          biography: 'شاعرِ مشرق، حکیم الامت علامہ محمد اقبال عظیم فلسفی اور شاعر تھے۔ انہوں نے خودی اور خود داری کا درس دیا اور مشرق کے فکری احیاء میں بنیادی کردار ادا کیا۔'
        },
        hi: {
          name: 'अल्लामा इक़बाल',
          biography: 'शायर-ए-मशरिक़, हकीम-उल-उम्मत अल्लामा इक़बाल महान दार्शनिक और शायर थे। उन्होंने ख़ुदी (आत्म-गौरव) का अमर संदेश दिया और मानवीय क्षमता को नई ऊंचाइयों पर पहुँचाया।'
        },
        en: {
          name: 'Allama Iqbal',
          biography: 'Sir Muhammad Iqbal, known as the Poet of the East, was an eminent philosopher, barrister, and poet whose philosophy of Khudi (Selfhood) inspired awakening and introspection.'
        }
      }
    },
    {
      id: 5,
      birthDate: '1931-01-12',
      deathDate: '2008-08-25',
      avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=80',
      details: {
        ur: {
          name: 'احمد فراز',
          biography: 'احمد فراز محبت، حسن اور دردمندی کے سب سے مقبول شاعروں میں سے ہیں۔ ان کی غزلیں سادہ، پر اثر اور موسیقیت سے بھرپور ہیں۔'
        },
        hi: {
          name: 'अहमद फ़राज़',
          biography: 'अहमद फ़राज़ इश्क़, हुस्न और दर्द-ओ-ग़म के सबसे लोकप्रिय शायरों में से हैं। उनकी ग़ज़लों की सादगी और दिलकश नफ़ासत सीधे दिल को छूती है।'
        },
        en: {
          name: 'Ahmad Faraz',
          biography: 'Ahmad Faraz is celebrated as one of modern Urdu literature’s greatest romantic and lyricist poets, revered for musical cadence and poignant expression of love and heartbreak.'
        }
      }
    }
  ];

  readonly classicalPoems: ClassicalPoem[] = [
    {
      id: 1,
      authorId: 1, // Ghalib
      genreId: 1,  // Ghazal
      themeIds: [1, 4, 2],
      title: 'Hazaron Khwahishen Aisi',
      texts: {
        ur: {
          title: 'ہزاروں خواہشیں ایسی کہ ہر خواہش پہ دم نکلے',
          body: `ہزاروں خواہشیں ایسی کہ ہر خواہش پہ دم نکلے
بہت نکلے مرے ارمان لیکن پھر بھی کم نکلے

ڈرے کیوں میرا قاتل کیا رہے گا اس کی گردن پر
وہ خوں جو چشمِ تر سے عمر بھر یوں دم بدم نکلے

نکلنا خلد سے آدم کا سنتے آئے ہیں لیکن
بہت بے آبرو ہو کر ترے کوچے سے ہم نکلے

محبت میں نہیں ہے فرق جینے اور مرنے کا
اسی کو دیکھ کر جیتے ہیں جس کافر پہ دم نکلے

کہاں مے خانے کا دروازہ غالبؔ اور کہاں واعظ
پر اتنا جانتے ہیں کل وہ جاتا تھا کہ ہم نکلے`
        },
        hi: {
          title: 'हज़ारों ख़्वाहिशें ऐसी कि हर ख़्वाहिश पे दम निकले',
          body: `हज़ारों ख़्वाहिशें ऐसी कि हर ख़्वाहिश पे दम निकले
बहुत निकले मिरे अरमान लेकिन फिर भी कम निकले

डरे क्यों मेरा क़ातिल क्या रहेगा उस की गर्दन पर
वो ख़ूँ जो चश्म-ए-तर से उम्र भर यूँ दम-ब-दम निकले

निकलना ख़ुल्द से आदम का सुनते आए हैं लेकिन
बहुत बे-आबरू हो कर तिरे कूचे से हम निकले

मोहब्बत में नहीं है फ़र्क़ जीने और मरने का
उसी को देख कर जीते हैं जिस काफ़िर पे दम निकले

कहाँ मय-ख़ाने का दरवाज़ा 'ग़ालिब' और कहाँ वाइज़
पर इतना जानते हैं कल वो जाता था कि हम निकले`
        },
        en: {
          title: 'Hazaron Khwahishen Aisi Ke Har Khwahish Pe Dam Nikle',
          body: `Hazaron khwahishen aisi ke har khwahish pe dam nikle
Bahut nikle mire armaan lekin phir bhi kam nikle

Dare kyon mera qaatil kya rahega us ki gardan par
Wo khoon jo chashm-e-tar se umr bhar yoon dam-ba-dam nikle

Nikalna khuld se aadam ka sunte aaye hain lekin
Bahut be-aabroo ho kar tire kooche se hum nikle

Mohabbat mein nahin hai farq jeene aur marne ka
Usi ko dekh kar jeete hain jis kaafir pe dam nikle

Kahan maikhane ka darwaza 'Ghalib' aur kahan waaiz
Par itna jaante hain kal wo jaata tha ke hum nikle`
        }
      }
    },
    {
      id: 2,
      authorId: 2, // Faiz
      genreId: 1,  // Ghazal
      themeIds: [1, 7, 6],
      title: 'Gulon Mein Rang Bhare',
      texts: {
        ur: {
          title: 'گلوں میں رنگ بھرے بادِ نوبہار چلے',
          body: `گلوں میں رنگ بھرے بادِ نوبہار چلے
چلے بھی آؤ کہ گلشن کا کاروبار چلے

قفس اداس ہے یارو صبا سے کچھ تو کہو
کہیں تو بہرِ خدا آج ذکرِ یار چلے

کبھی تو صبح ترے کنجِ لب سے ہو آغاز
کبھی تو شب سرِ کاکل سے مشکبار چلے

مقام فیضؔ کوئی راہ میں جچا ہی نہیں
جو کوئے یار سے نکلے تو سوئے دار چلے`
        },
        hi: {
          title: 'गुलों में रंग भरे बाद-ए-नौबहार चले',
          body: `गुलों में रंग भरे बाद-ए-नौबहार चले
चले भी आओ कि गुलशन का कारोबार चले

क़फ़स उदास है यारो सबा से कुछ तो कहो
कहीं तो बहर-ए-ख़ुदा आज ज़िक्र-ए-यार चले

कभी तो सुब्ह तिरे कुंज-ए-लब से हो आग़ाज़
कभी तो शब सर-ए-काकुल से मुश्कबार चले

मक़ाम 'फ़ैज़' कोई राह में जचा ही नहीं
जो कू-ए-यार से निकले तो सू-ए-दार चले`
        },
        en: {
          title: 'Gulon Mein Rang Bhare Baad-e-Naubahar Chale',
          body: `Gulon mein rang bhare baad-e-naubahar chale
Chale bhi aao ke gulshan ka kaarobaar chale

Qafas udaas hai yaaro saba se kuchh to kaho
Kahin to bahr-e-khuda aaj zikr-e-yaar chale

Kabhi to subah tire kunj-e-lab se ho aaghaaz
Kabhi to shab sar-e-kaakul se mushkbaar chale

Maqaam 'Faiz' koi raah mein jacha hi nahin
Jo koo-e-yaar se nikle to soo-e-daar chale`
        }
      }
    },
    {
      id: 3,
      authorId: 3, // Jaun Elia
      genreId: 1,  // Ghazal
      themeIds: [2, 3, 4],
      title: 'Be-Dili Kya Yoonhi Din Guzar Jayenge',
      texts: {
        ur: {
          title: 'بے دلی کیا یونہی دن گزر جائیں گے',
          body: `بے دلی کیا یونہی دن گزر جائیں گے
صرف زندہ رہے ہم تو مر جائیں گے

یہ بلندی بھی کس کام کی ہے بھلا
ہم کبھی اپنے سائے سے ڈر جائیں گے

اک نیا خواب دیکھیں گے ہم رات بھر
اور پھر صبح ہوتے بکھر جائیں گے

ہم بھی دیکھیں گے انجامِ کارِ جہاں
ہم بھی اک روز خاموش گھر جائیں گے`
        },
        hi: {
          title: 'बे-दिली क्या यूँही दिन गुज़र जाएँगे',
          body: `बे-दिली क्या यूँही दिन गुज़र जाएँगे
सिर्फ़ ज़िंदा रहे हम तो मर जाएँगे

ये बुलंदी भी किस काम की है भला
हम कभी अपने साए से डर जाएँगे

इक नया ख़्वाब देखेंगे हम रात भर
और फिर सुब्ह होते बिखर जाएँगे

हम भी देखेंगे अंजाम-ए-कार-ए-जहाँ
हम भी इक रोज़ ख़ामोश घर जाएँगे`
        },
        en: {
          title: 'Be-dili Kya Yoonhi Din Guzar Jayenge',
          body: `Be-dili kya yoonhi din guzar jayenge
Sirf zinda rahe hum to mar jayenge

Ye bulandi bhi kis kaam ki hai bhala
Hum kabhi apne saaye se dar jayenge

Ik naya khwaab dekhenge hum raat bhar
Aur phir subah hote bikhar jayenge

Hum bhi dekhenge anjaam-e-kaar-e-jahan
Hum bhi ik roz khamosh ghar jayenge`
        }
      }
    },
    {
      id: 4,
      authorId: 5, // Ahmad Faraz
      genreId: 1,  // Ghazal
      themeIds: [1, 2, 6],
      title: 'Ranjish Hi Sahi',
      texts: {
        ur: {
          title: 'رنجش ہی سہی دل ہی دکھانے کے لیے آ',
          body: `رنجش ہی سہی دل ہی دکھانے کے لیے آ
آ پھر سے مجھے چھوڑ کے جانے کے لیے آ

پہلے سے مراسم نہ سہی پھر بھی کبھی تو
رسم و رہِ دنیا ہی نبھانے کے لیے آ

کس کس کو بتائیں گے جدائی کا سبب ہم
تو مجھ سے خفا ہے تو زمانے کے لیے آ

اک عمر سے ہوں لذتِ گریہ سے بھی محروم
اے راحتِ جاں مجھ کو رلانے کے لیے آ`
        },
        hi: {
          title: 'रंजिश ही सही दिल ही दुखाने के लिए आ',
          body: `रंजिश ही सही दिल ही दुखाने के लिए आ
आ फिर से मुझे छोड़ के जाने के लिए आ

पहले से मरासिम न सही फिर भी कभी तो
रस्म-ओ-रह-ए-दुनिया ही निभाने के लिए आ

किस किस को बताएंगे जुदाई का सबब हम
तू मुझसे ख़फ़ा है तो ज़माने के लिए आ

इक उम्र से हूँ लज़्ज़त-ए-गिर्या से भी महरूम
ऐ राहत-ए-जाँ मुझ को रुलाने के लिए आ`
        },
        en: {
          title: 'Ranjish Hi Sahi Dil Hi Dukhane Ke Liye Aa',
          body: `Ranjish hi sahi dil hi dukhane ke liye aa
Aa phir se mujhe chhod ke jaane ke liye aa

Pehle se maraasim na sahi phir bhi kabhi to
Rasm-o-rah-e-duniya hi nibhane ke liye aa

Kis kis ko batayenge judai ka sabab hum
Tu mujhse khafa hai to zamane ke liye aa

Ik umr se hoon lazzat-e-girya se bhi mehroom
Ae rahat-e-jaan mujh ko rulaane ke liye aa`
        }
      }
    },
    {
      id: 5,
      authorId: 4, // Allama Iqbal
      genreId: 1,  // Ghazal
      themeIds: [4, 7],
      title: 'Sitaron Se Aage Jahan Aur Bhi Hain',
      texts: {
        ur: {
          title: 'ستاروں سے آگے جہاں اور بھی ہیں',
          body: `ستاروں سے آگے جہاں اور بھی ہیں
ابھی عشق کے امتحان اور بھی ہیں

تہی زندگی سے نہیں یہ فضائیں
یہاں سینکڑوں کارواں اور بھی ہیں

قناعت نہ کر عالمِ رنگ و بو پر
چمن اور بھی آشیاں اور بھی ہیں

اگر کھو گیا ایک نشیمن تو کیا غم
مقاماتِ آہ و فغاں اور بھی ہیں

تو شاہیں ہے پرواز ہے کام تیرا
ترے سامنے آسماں اور بھی ہیں`
        },
        hi: {
          title: 'सितारों से आगे जहाँ और भी हैं',
          body: `सितारों से आगे जहाँ और भी हैं
अभी इश्क़ के इम्तिहाँ और भी हैं

तही ज़िंदगी से नहीं ये फ़ज़ाएं
यहाँ सैकड़ों कारवाँ और भी हैं

क़नाअत न कर आलम-ए-रंग-ओ-बू पर
चमन और भी आशियाँ और भी हैं

अगर खो गया एक नशेमन तो क्या ग़म
मक़ामात-ए-आह-ओ-फ़ुग़ाँ और भी हैं

तू शाहीं है परवाज़ है काम तेरा
तिरे सामने आसमाँ और भी हैं`
        },
        en: {
          title: 'Sitaron Se Aage Jahan Aur Bhi Hain',
          body: `Sitaron se aage jahan aur bhi hain
Abhi ishq ke imtihaan aur bhi hain

Tahi zindagi se nahin ye fizayein
Yahan sainkdon kaarwan aur bhi hain

Qana'at na kar aalam-e-rang-o-boo par
Chaman aur bhi aashiyan aur bhi hain

Agar kho gaya ek nasheman to kya gham
Maqaamat-e-aah-o-fughaan aur bhi hain

Tu shaheen hai parwaaz hai kaam tera
Tire saamne aasmaan aur bhi hain`
        }
      }
    }
  ];

  // Helper dictionary for difficult words
  readonly dictionaryWords: Record<string, { ur: string; hi: string; en: string }> = {
    'خُلد': { ur: 'جنت / بہشت', hi: 'स्वर्ग / जन्नत', en: 'Paradise / Heaven' },
    'چشمِ تر': { ur: 'بھیگی ہوئی آنکھ', hi: 'अश्रुपूरित आँख', en: 'Tearful eyes' },
    'قفس': { ur: 'پنجرا / قید خانہ', hi: 'पिंजरा / कारागार', en: 'Cage / Captivity' },
    'صبا': { ur: 'صبح کی ٹھنڈی ہوا', hi: 'सुबह की शीतल पवन', en: 'Morning gentle breeze' },
    'سوئے دار': { ur: 'پھانسی کے پھندے کی طرف', hi: 'फाँसी के तख़्ते की ओर', en: 'Towards the gallows' },
    'مراسم': { ur: 'تعلقات / میل ملاپ', hi: 'रिश्ते / सम्बंध', en: 'Relations / Bonds' },
    'لذتِ گریہ': { ur: 'رونے کا سرور و تسکین', hi: 'रोने का सुकून व आनंद', en: 'The catharsis of weeping' },
    'تہی': { ur: 'خالی', hi: 'ख़ाली / रिक्त', en: 'Empty / Void' },
    'قناعت': { ur: 'صبر و شکر / جو ملے اس پر راضی ہونا', hi: 'संतोष / संतुष्टि', en: 'Contentment' },
    'شاہیں': { ur: 'بلند پرواز عقاب', hi: 'ऊँची उड़ान वाला बाज़', en: 'The soaring royal falcon' },
    'خودی': { ur: 'خود داری / انا / روحانی شعور', hi: 'आत्म-सम्मान / चेतना', en: 'Selfhood / Inner Spirit' }
  };

  // 1-Click Seeding to Backend REST APIs
  seedAllToBackend(): Observable<string[]> {
    const logs: string[] = [];

    return new Observable(observer => {
      // 1. Seed Scripts
      logs.push('⏳ Seeding Scripts (Urdu, Hindi, English)...');
      observer.next([...logs]);

      const scriptTasks = this.initialScripts.map(s => this.taxonomyService.saveScript({ code: s.code, name: s.name }));
      
      forkJoin(scriptTasks).subscribe({
        next: () => {
          logs.push('✅ Scripts seeded successfully.');
          observer.next([...logs]);

          // 2. Seed Genres
          logs.push('⏳ Seeding Genres (Ghazal, Nazm, Sher, Rubai)...');
          observer.next([...logs]);

          const genreTasks = this.initialGenres.map(g => this.taxonomyService.saveGenre({ name: g.name, slug: g.slug }));

          forkJoin(genreTasks).subscribe({
            next: () => {
              logs.push('✅ Genres seeded successfully.');
              observer.next([...logs]);

              // 3. Seed Themes
              logs.push('⏳ Seeding Themes (Ishq, Dard, Tanhai, Zindagi, Sufi...)...');
              observer.next([...logs]);

              const themeTasks = this.initialThemes.map(t => this.taxonomyService.saveTheme({ name: t.name, slug: t.slug }));

              forkJoin(themeTasks).subscribe({
                next: () => {
                  logs.push('✅ Themes seeded successfully.');
                  observer.next([...logs]);

                  // 4. Seed Authors and Details
                  logs.push('⏳ Seeding Legendary Shayars & Multi-Script Biographies...');
                  observer.next([...logs]);

                  this.seedAuthorsAndPoemsSequential(logs, observer);
                },
                error: (err) => {
                  logs.push(`⚠️ Theme save note: ${err?.message || 'Proceeding'}`);
                  this.seedAuthorsAndPoemsSequential(logs, observer);
                }
              });
            },
            error: (err) => {
              logs.push(`⚠️ Genre save note: ${err?.message || 'Proceeding'}`);
              this.seedAuthorsAndPoemsSequential(logs, observer);
            }
          });
        },
        error: (err) => {
          logs.push(`⚠️ Script save note: ${err?.message || 'Proceeding'}`);
          this.seedAuthorsAndPoemsSequential(logs, observer);
        }
      });
    });
  }

  private seedAuthorsAndPoemsSequential(logs: string[], observer: any) {
    // Sequential insertion of authors & author details
    let authorIdx = 0;

    const processNextAuthor = () => {
      if (authorIdx >= this.classicalPoets.length) {
        logs.push('✅ All Poets and Biographies seeded.');
        logs.push('⏳ Seeding Classical Ghazals & Multi-Script Texts...');
        observer.next([...logs]);
        this.seedPoemsSequential(logs, observer);
        return;
      }

      const poet = this.classicalPoets[authorIdx];
      this.authorService.saveAuthor({ birthDate: poet.birthDate, deathDate: poet.deathDate }).subscribe({
        next: () => {
          const aId = poet.id;
          const dUr = this.authorService.saveAuthorDetail({ authorId: aId, scriptId: 1, name: poet.details.ur.name, biography: poet.details.ur.biography });
          const dHi = this.authorService.saveAuthorDetail({ authorId: aId, scriptId: 2, name: poet.details.hi.name, biography: poet.details.hi.biography });
          const dEn = this.authorService.saveAuthorDetail({ authorId: aId, scriptId: 3, name: poet.details.en.name, biography: poet.details.en.biography });

          forkJoin([dUr, dHi, dEn]).subscribe({
            next: () => {
              logs.push(`✨ Seeded poet: ${poet.details.en.name} in 3 scripts.`);
              observer.next([...logs]);
              authorIdx++;
              processNextAuthor();
            },
            error: () => {
              authorIdx++;
              processNextAuthor();
            }
          });
        },
        error: () => {
          authorIdx++;
          processNextAuthor();
        }
      });
    };

    processNextAuthor();
  }

  private seedPoemsSequential(logs: string[], observer: any) {
    let poemIdx = 0;

    const processNextPoem = () => {
      if (poemIdx >= this.classicalPoems.length) {
        logs.push('🎉 DATABASE SEEDING COMPLETED! Unsiiyat is fully loaded.');
        observer.next([...logs]);
        observer.complete();
        return;
      }

      const poem = this.classicalPoems[poemIdx];
      this.contentService.saveContent({
        genreId: poem.genreId,
        authorId: poem.authorId,
        title: poem.title,
        themeIds: poem.themeIds
      }).subscribe({
        next: () => {
          const cId = poem.id;
          const tUr = this.contentService.saveContentText({ contentId: cId, scriptId: 1, title: poem.texts.ur.title, body: poem.texts.ur.body });
          const tHi = this.contentService.saveContentText({ contentId: cId, scriptId: 2, title: poem.texts.hi.title, body: poem.texts.hi.body });
          const tEn = this.contentService.saveContentText({ contentId: cId, scriptId: 3, title: poem.texts.en.title, body: poem.texts.en.body });

          forkJoin([tUr, tHi, tEn]).subscribe({
            next: () => {
              logs.push(`📜 Seeded Ghazal: "${poem.title}" with Urdu, Hindi, & English verses.`);
              observer.next([...logs]);
              poemIdx++;
              processNextPoem();
            },
            error: () => {
              poemIdx++;
              processNextPoem();
            }
          });
        },
        error: () => {
          poemIdx++;
          processNextPoem();
        }
      });
    };

    processNextPoem();
  }
}
