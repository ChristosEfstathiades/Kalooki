import { test } from '@japa/runner'
import { findBlockedWordInUsername, isReservedUsername } from '#services/username_filter'

test.group('Username filter', () => {
  test('blocks a blocked word anywhere in the name', ({ assert }) => {
    assert.equal(findBlockedWordInUsername('fuck'), 'fuck')
    assert.equal(findBlockedWordInUsername('xXfuckXx'), 'fuck')
    assert.equal(findBlockedWordInUsername('KalookiBitch99'), 'bitch')
  })

  test('is case-insensitive', ({ assert }) => {
    assert.equal(findBlockedWordInUsername('FuCkEr'), 'fuck')
  })

  test('sees through lookalike characters', ({ assert }) => {
    assert.equal(findBlockedWordInUsername('n1gg3r'), 'nigger')
    assert.equal(findBlockedWordInUsername('ni99er'), 'nigger')
    assert.equal(findBlockedWordInUsername('5h1t_head'), 'shit')
    assert.equal(findBlockedWordInUsername('cvnt'), 'cunt')
  })

  test('sees through separators, repeats and ph', ({ assert }) => {
    assert.equal(findBlockedWordInUsername('f_u_c_k'), 'fuck')
    assert.equal(findBlockedWordInUsername('fuuuuck'), 'fuck')
    assert.equal(findBlockedWordInUsername('phuck_you'), 'fuck')
  })

  test('blocks words a username needs but chat only masks', ({ assert }) => {
    assert.equal(findBlockedWordInUsername('BigCock69'), 'cock')
    assert.equal(findBlockedWordInUsername('RapeMaster'), 'rape')
    assert.equal(findBlockedWordInUsername('hitler1945'), 'hitler')
  })

  test('leaves ordinary names alone', ({ assert }) => {
    assert.isNull(findBlockedWordInUsername('player_one'))
    assert.isNull(findBlockedWordInUsername('KalookiKing'))
    assert.isNull(findBlockedWordInUsername('Nigeria_92'))
    assert.isNull(findBlockedWordInUsername('Nasir'))
    assert.isNull(findBlockedWordInUsername('Magnus'))
  })

  test('innocent words containing a blocked word are allowed', ({ assert }) => {
    for (const username of [
      'Scunthorpe',
      'raccoon99',
      'Tycoon_Tom',
      'Spicy_Pete',
      'PakistanFan',
      'Montenegro',
      'Peacock',
      'Cocktail_Joe',
      'Hancock',
      'Dickens',
      'Prickett',
      'Uranus',
      'Grapevine',
      'therapist',
      'Torpedo',
    ]) {
      assert.isNull(findBlockedWordInUsername(username), `${username} should be allowed`)
    }
  })

  test('three-letter slurs must stand alone', ({ assert }) => {
    assert.equal(findBlockedWordInUsername('wog'), 'wog')
    assert.equal(findBlockedWordInUsername('xX_wog_Xx'), 'wog')
    assert.equal(findBlockedWordInUsername('fag69'), 'fag')

    // The same letters buried inside a longer word are left alone
    assert.isNull(findBlockedWordInUsername('showgirl'))
    assert.isNull(findBlockedWordInUsername('TwoGames'))
    assert.isNull(findBlockedWordInUsername('Fagan'))
  })

  test('cutting out an allowed word cannot join a blocked one', ({ assert }) => {
    assert.equal(findBlockedWordInUsername('CocktailCock'), 'cock')
  })
})

test.group('Reserved usernames', () => {
  test('reserves staff and site names', ({ assert }) => {
    for (const username of [
      'admin',
      'ADMIN',
      'Moderator',
      'mods',
      'staff',
      'support',
      'system',
      'official',
      'Kalooki',
      'KalookiOnline',
      'RustyBot',
    ]) {
      assert.isTrue(isReservedUsername(username), `${username} should be reserved`)
    }
  })

  test('sees through decoration and lookalikes', ({ assert }) => {
    assert.isTrue(isReservedUsername('adm1n'))
    assert.isTrue(isReservedUsername('admln'))
    assert.isTrue(isReservedUsername('a_d_m_i_n'))
    assert.isTrue(isReservedUsername('admin123'))
    assert.isTrue(isReservedUsername('_admin_'))
    assert.isTrue(isReservedUsername('M0der4t0r'))
    assert.isTrue(isReservedUsername('moddd'))
    assert.isTrue(isReservedUsername('KAL00KI'))

    // The site name with a number stuck on it is the same shape as
    // "admin123", so it goes the same way. "KalookiKing" is still free.
    assert.isTrue(isReservedUsername('Kalooki99'))
  })

  test('reserves the long staff words anywhere in a name', ({ assert }) => {
    assert.isTrue(isReservedUsername('TheModerator'))
    assert.isTrue(isReservedUsername('Site_Administrator'))
  })

  test('reserves the site name paired with a staff word', ({ assert }) => {
    assert.isTrue(isReservedUsername('KalookiAdmin'))
    assert.isTrue(isReservedUsername('Mod_Kalooki'))
    assert.isTrue(isReservedUsername('kalooki_support'))
  })

  test('leaves ordinary names that merely contain one alone', ({ assert }) => {
    for (const username of [
      'Badminton',
      'KalookiKing',
      'Kalooki_Fan_92',
      'Modern_Man',
      'Model_T',
      'RootBeer',
      'Teammate',
      'Helper',
      'Supportive',
      'Bobby',
      'player_one',
    ]) {
      assert.isFalse(isReservedUsername(username), `${username} should be allowed`)
    }
  })
})
